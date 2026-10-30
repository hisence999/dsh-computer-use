// Per-conversation tool exposure.
//
// `ctx.tools.register(definition)` chooses its layer from the `dsh.scope` tag on
// the context that performs the registration — not from where the `tools`
// service was read. Registering on the plugin's own context therefore lands in
// the context-global layer, where the tool survives the conversation and every
// other agent's next assembly sees it. Registering through `agent.ctx` lands in
// that agent's session layer: only that conversation sees it, and it disappears
// with the agent.
//
// This module keeps the bookkeeping for that: one ledger per calling agent, the
// disposers we own, and a read-back that reports where a registration actually
// landed instead of where we intended to put it. See
// docs/session-scoped-tools.md for the mechanism and the fallbacks.
const NOOP = () => {};

/** The calling agent, when the host supplied a real object for this execution. */
export function agentOf(exec) {
  const agent = exec?.agent;
  return typeof agent === 'object' && agent !== null ? agent : undefined;
}

/**
 * The agent-scoped tool registry, or undefined when this host/agent cannot
 * expose one. Reading `agent.ctx` can throw for agents assembled without the
 * declared injection, so the failure is treated as "no session registry".
 */
export function scopedToolsOf(agent) {
  if (!agent) return undefined;
  try {
    const tools = agent.ctx?.tools;
    return tools && typeof tools.register === 'function' ? tools : undefined;
  } catch {
    return undefined;
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function uniqueNames(names) {
  const seen = new Set();
  const result = [];
  for (const name of names || []) {
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * Owns every tool registration this plugin makes after startup.
 *
 * @param tools - the plugin context's tool registry (the global layer).
 * @param buildDefinition - raw tool name to a ToolDefinition, or undefined when
 *   that name is not part of what the server may offer at all.
 * @param logger - host logger; only used for diagnostics.
 */
export class SessionToolScopes {
  constructor({ tools, buildDefinition, logger = {} }) {
    if (!tools || typeof tools.register !== 'function') throw new Error('dsh-computer-use: the tools service is not available');
    this.tools = tools;
    this.buildDefinition = buildDefinition;
    this.logger = { warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : NOOP };
    this.agents = new WeakMap();
    this.shared = { agent: undefined, names: new Map() };
    this.globals = new Map();
    this.disposers = new Set();
    this.disposed = false;
  }

  /** Names that startup registered globally; they count as already exposed. */
  seed(names) {
    for (const raw of uniqueNames(names)) if (!this.globals.has(raw)) this.globals.set(raw, { raw, scope: 'global', startup: true });
  }

  exposureOf(exec) {
    const agent = agentOf(exec);
    if (!agent) return this.shared;
    let exposure = this.agents.get(agent);
    if (!exposure) {
      exposure = { agent, names: new Map() };
      this.agents.set(agent, exposure);
    }
    return exposure;
  }

  /** Where a public name is readable from: 'global', 'session' or 'unknown'. */
  scopeOf(publicName, agent) {
    try {
      if (this.tools.get(publicName) !== undefined) return 'global';
    } catch {
      return 'unknown';
    }
    if (!agent) return 'global';
    try {
      if (typeof this.tools.get === 'function' && this.tools.get(publicName, agent) !== undefined) return 'session';
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }

  scopeLabel(exposure) {
    const scopes = new Set([...exposure.names.values()].map(entry => entry.scope));
    if (scopes.size === 1) return [...scopes][0];
    return exposure.agent ? 'session' : 'global';
  }

  /** Enabled names for this exposure, with the scope each one landed in. */
  describe(exec) {
    const exposure = this.exposureOf(exec);
    return {
      scope: this.scopeLabel(exposure),
      tools: [...exposure.names.values()].map(entry => ({
        name: entry.raw,
        tool: entry.name,
        scope: entry.scope,
        ...(entry.startup ? { startup: true } : {})
      }))
    };
  }

  /**
   * Register the named tools for this execution's agent.
   *
   * Idempotent per layer: a name already exposed here is reported as `already`
   * rather than registered twice, because a duplicate registration on one layer
   * is a hard error in the host registry.
   */
  enable(names, exec) {
    const exposure = this.exposureOf(exec);
    const scoped = scopedToolsOf(exposure.agent);
    const loaded = [];
    const already = [];
    const errors = [];
    for (const raw of uniqueNames(names)) {
      if (exposure.names.has(raw) || this.globals.has(raw)) {
        already.push(raw);
        continue;
      }
      let definition;
      try {
        definition = this.buildDefinition(raw);
      } catch (error) {
        errors.push({ name: raw, message: messageOf(error) });
        continue;
      }
      if (!definition) {
        errors.push({ name: raw, message: `Unknown tool: ${raw}` });
        continue;
      }
      const target = scoped ?? this.tools;
      try {
        const dispose = target.register(definition);
        const entry = {
          raw,
          name: definition.name,
          dispose: typeof dispose === 'function' ? dispose : undefined,
          scope: scoped ? 'session' : 'global'
        };
        exposure.names.set(raw, entry);
        if (!scoped) this.globals.set(raw, entry);
        if (entry.dispose) this.disposers.add(entry);
        loaded.push(raw);
      } catch (error) {
        // A failure is never silent and never blocks the rest of the batch.
        errors.push({ name: raw, message: messageOf(error) });
      }
    }
    for (const raw of loaded) {
      const entry = exposure.names.get(raw);
      if (entry) entry.scope = this.scopeOf(entry.name, exposure.agent);
    }
    return { loaded, already, errors, scope: this.scopeLabel(exposure), enabled: [...exposure.names.keys()] };
  }

  /** Remove the named tools from this execution's exposure only. */
  disable(names, exec) {
    const exposure = this.exposureOf(exec);
    const removed = [];
    const missing = [];
    const errors = [];
    for (const raw of uniqueNames(names)) {
      const entry = exposure.names.get(raw);
      if (!entry) {
        missing.push(raw);
        continue;
      }
      try {
        if (entry.dispose) entry.dispose();
      } catch (error) {
        errors.push({ name: raw, message: messageOf(error) });
        continue;
      }
      exposure.names.delete(raw);
      this.disposers.delete(entry);
      if (entry.scope !== 'session' && this.globals.get(raw) === entry) this.globals.delete(raw);
      removed.push(raw);
    }
    return { removed, missing, errors, scope: this.scopeLabel(exposure), enabled: [...exposure.names.keys()] };
  }

  /** Drop every tool this exposure loaded. */
  reset(exec) {
    const exposure = this.exposureOf(exec);
    return this.disable([...exposure.names.keys()], exec);
  }

  /** Release every registration this plugin owns, in any layer. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.disposers];
    this.disposers.clear();
    for (const entry of entries) {
      try {
        entry.dispose?.();
      } catch (error) {
        this.logger.warn(`dsh-computer-use: releasing ${entry.raw} failed: ${messageOf(error)}`);
      }
    }
    this.globals.clear();
    this.shared.names.clear();
  }
}
