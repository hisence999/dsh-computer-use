// The plugin owns its MCP connection so tool registration can follow the
// calling agent. `@deepseek-ai/dsh-mcp-client` registers tools on its own
// plugin context, i.e. the context-global layer: one activation inside one
// conversation published the tool to every conversation, and a new
// conversation inherited the whole desktop tool set. See
// docs/session-scoped-tools.md for the mechanism this file implements.
import z from '@deepseek-ai/schemastery';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_SETTINGS, normalizeSettings, enabledToolsForSettings, toolSelectionKey, STOP_SHORTCUT_PATTERN, TOOL_NAMES, repairStaleSettings } from './settings.mjs';
import { atomicJson } from './takeover.mjs';
import { installActivity } from './activity.mjs';
import { SessionToolScopes } from './session-tools.mjs';
import { StdioMcpClient } from './mcp-stdio.mjs';

export const name = 'dsh-computer-use';
export const inject = ['tools'];
export function createLiveReference(value){
  let current=Array.isArray(value)?Object.freeze([...value]):value;
  return Object.freeze({get:()=>current,[Symbol.for('cosmokit.volatile.write')]:next=>{current=next;}});
}
const fields = {
  mode: z.union([z.const('lite'),z.const('full')]).default('full').description('旧版工具模式 / Legacy tool mode'),
  toolPreset: z.union(['auto','full','lite','lazy','custom'].map(value=>z.const(value))).default('auto').description('工具加载方案 / Tool preset'),
  enabledTools: z.array(z.union(TOOL_NAMES.map(name=>z.const(name)))).max(TOOL_NAMES.length).default([...TOOL_NAMES]).description('启用的工具 / Enabled tools'),
  indicatorEnabled: z.boolean().default(true).description('接管提示 / Takeover indicator'),
  cursorIndicatorEnabled: z.boolean().default(true).description('鼠标指示 / Pointer indicator'),
  remoteIndicatorVisible: z.boolean().default(true).description('远程与录屏可见 / Visible in remote sessions and recordings'),
  indicatorText: z.string().default(DEFAULT_SETTINGS.indicatorText).description('提示文字 / Banner text'),
  indicatorPosition: z.union([z.const('top'),z.const('bottom')]).default('top').description('提示位置 / Banner position'),
  indicatorIdleMs: z.number().min(200).max(3000).default(800).description('结束后隐藏延时（毫秒） / Hide delay (ms)'),
  stopShortcut: z.string().pattern(STOP_SHORTCUT_PATTERN).default('').description('自定义停止快捷键 / Custom stop shortcut'),
  resumeToken: z.number().min(0).default(0),
  previewToken: z.number().min(0).default(0)
};
export const SettingsConfig = z.object(fields);
// Some Desktop loaders resolve Schemastery without the volatile() convenience
// method. Never silently omit the metadata the host uses to expose the form.
export const Config = z.object({ ...Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,typeof field.volatile === 'function' ? field.volatile() : field.extra('volatile',true)])),
  // wait_for accepts 60 s; leave room for backend startup and its final result.
  toolCallTimeoutMs: z.number().min(1).default(90000).description('工具调用超时（毫秒） / Tool timeout (ms)'),
  failOnStartupError: z.boolean().default(false)
});
// A mixed-version Desktop can understand volatile schema metadata while its
// selected validator still returns plain values. Give the Loader the official
// shared reference protocol for both initial and candidate validation. The
// fields are validated JSON scalars or an immutable array of tool names.
// The same validator also accepts a saved choice this version no longer offers
// (see repairStaleSettings): DSH would otherwise refuse the entry and every
// tool would vanish. What was reset rides along on the value for apply().
export const REPAIRED_SETTINGS=Symbol.for('dsh-computer-use.repairedSettings');
const validation=Config['~standard'];
Object.defineProperty(Config,'~standard',{value:{...validation,validate(input){
  let result=validation.validate(input),repaired=[];
  if(result.issues){
    const repair=repairStaleSettings(input);
    if(repair.repaired.length){const retry=validation.validate(repair.value);if(!retry.issues){result=retry;repaired=repair.repaired;}}
  }
  if(!result.issues){
    for(const key of Object.keys(fields)){
      if(typeof result.value[key]?.get!=='function')result.value[key]=createLiveReference(result.value[key]);
    }
    if(repaired.length)Object.defineProperty(result.value,REPAIRED_SETTINGS,{value:Object.freeze(repaired)});
  }
  return result;
}}});
// Two entries of this plugin in one profile (a bundle listed twice, or an old
// manual entry beside the bundle) start two servers under one name, and both
// would register the same public tool names. Report it instead of leaving it silent.
const liveAdapters=new Set();
export function bridgeConfig(config = {}, runtime = {}) {
  const settings = normalizeSettings(config);
  return {
    serverName: 'dsh-computer-use', transport: 'stdio', command: process.execPath,
    args: [fileURLToPath(new URL('./server.mjs', import.meta.url))],
    env: { ELECTRON_RUN_AS_NODE: '1', DCU_TOOL_MODE: settings.toolPreset==='lazy'?'lazy':settings.mode, DCU_ENABLED_TOOLS: JSON.stringify(enabledToolsForSettings(settings)), DCU_SETTINGS_JSON: JSON.stringify(settings),
      ...(runtime.configFile ? { DCU_CONFIG_FILE: runtime.configFile, DCU_STATE_FILE: runtime.stateFile } : {}),
      ...(runtime.activityFile ? {DCU_ACTIVITY_FILE:runtime.activityFile}: {}),
      ...(runtime.notices ? {DCU_ADAPTER_NOTICES:JSON.stringify(runtime.notices)}: {}) },
    toolCallTimeoutMs: config.toolCallTimeoutMs ?? 90000,
    failOnStartupError: config.failOnStartupError ?? false
  };
}
// DeepSeek function names are 64 chars of [A-Za-z0-9_-]. This mirrors the
// bridge's derivation so an installation that moves between this plugin and
// @deepseek-ai/dsh-mcp-client keeps exactly the same public tool names.
const MAX_PUBLIC_NAME_LENGTH = 64;
const HASH_LENGTH = 12;
const INVALID_NAME_CHARS = /[^A-Za-z0-9_-]/g;
export function publicToolName(serverName, rawName) {
  const joined = `mcp__${serverName}__${rawName}`;
  const normalized = joined.replace(INVALID_NAME_CHARS, '_');
  if (normalized === joined && normalized.length <= MAX_PUBLIC_NAME_LENGTH) return normalized;
  const hash = createHash('sha256').update(`${serverName}\0${rawName}`).digest('hex').slice(0, HASH_LENGTH);
  return `${normalized.slice(0, MAX_PUBLIC_NAME_LENGTH - HASH_LENGTH - 1)}_${hash}`;
}
const TOOL_PREFIX = 'windows_computer_use_';
const MANAGEMENT_TOOL = TOOL_PREFIX + 'tools';
// The model-facing management schema. `catalog` is deliberately absent: only
// this plugin's startup needs the full descriptor set.
const MANAGEMENT_SCHEMA = {
  type: 'object', additionalProperties: false, properties: {
    operation: { type: 'string', enum: ['list','describe','enable','disable','reset'], default: 'list' },
    names: { type: 'array', maxItems: TOOL_NAMES.length + 1, items: { type: 'string' } }
  }
};
function bareToolName(name) {
  return name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name;
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function mcpText(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}
/** Read the tool descriptor set the settings allow, without advertising it. */
async function loadCatalog(client, advertised, options) {
  try {
    const reply = await client.callTool(MANAGEMENT_TOOL, { operation: 'catalog' }, { timeoutMs: options.timeoutMs });
    const block = Array.isArray(reply?.content) ? reply.content.find(item => item?.type === 'text') : undefined;
    const parsed = block ? JSON.parse(block.text) : null;
    const entries = new Map();
    for (const tool of parsed?.tools || []) {
      const raw = tool.name === 'tools' ? MANAGEMENT_TOOL : TOOL_PREFIX + bareToolName(tool.name);
      if (tool?.inputSchema) entries.set(raw, { name: raw, description: tool.description ?? '', inputSchema: tool.inputSchema });
    }
    if (entries.size) return entries;
  } catch (error) {
    options.logger.warn(`dsh-computer-use: the tool catalogue was unavailable: ${errorText(error)}`);
  }
  // Older servers cannot answer `catalog`; fall back to what startup advertised.
  const fallback = new Map();
  for (const tool of advertised) {
    if (tool?.name && tool.inputSchema) fallback.set(tool.name, { name: tool.name, description: tool.description ?? '', inputSchema: tool.inputSchema });
  }
  return fallback;
}
function managementDescription(managementOnly) {
  const lazy = managementOnly ? 'Lazy startup: ' : '';
  const capability = managementOnly ? 'reads and operates real Windows apps (UI Automation, screenshots, OCR, input, windows); enable tools before desktop use. ' : '';
  return lazy + capability + 'List capabilities; describe reads one full schema; enable/disable accepts names or ["*"] for all allowed desktop tools; reset restores startup selection. Enabled tools are available to this conversation only.';
}
/**
 * Resolve the requested management names against the catalogue.
 * `["*"]` means "every tool the settings allow" and must arrive alone.
 */
function requestedTools(args, catalog) {
  const requested = Array.isArray(args?.names) ? args.names : [];
  const names = requested.map(name => (typeof name === 'string' ? name.trim() : '')).filter(Boolean);
  if (names.includes('*') && names.length !== 1) throw new Error('INVALID_ARGUMENTS: use ["*"] alone with enable or disable');
  if (names[0] === '*') return { requested: names, names: [...catalog.keys()] };
  const resolved = names.map(name => TOOL_PREFIX + bareToolName(name));
  return { requested: names, names: [...new Set(resolved)] };
}
function unknownToolError(rawName) {
  if (TOOL_NAMES.includes(bareToolName(rawName))) {
    return new Error('TOOL_DISABLED_IN_SETTINGS: This tool is disabled by the user in Settings > Computer Use (设置 > 电脑操控 in the Chinese interface).');
  }
  return new Error(`Unknown tool: ${bareToolName(rawName)}`);
}
/**
 * The management tool: session-scoped activation of desktop tools.
 *
 * The server still owns capability text and the actual calls; this handler owns
 * which conversation sees which tool, because that is a per-agent fact the
 * server cannot represent over one stdio pipe.
 */
function manageTools(args, exec, state) {
  const { scopes, catalog, settings, notices } = state;
  const operation = typeof args?.operation === 'string' ? args.operation : 'list';
  const mode = settings.toolPreset === 'lazy' ? 'lazy' : settings.mode;
  const exposure = scopes.describe(exec);
  const enabled = new Set(exposure.tools.map(entry => entry.name));
  if (operation === 'list' || operation === 'catalog') {
    return {
      mode,
      scope: exposure.scope,
      ...(notices ? { notices } : {}),
      enabled: [...enabled],
      tools: operation === 'catalog'
        ? [...catalog.values()].map(entry => ({ name: bareToolName(entry.name), description: entry.description, inputSchema: entry.inputSchema }))
        : [...catalog.values()].map(entry => ({
          name: bareToolName(entry.name), description: entry.description,
          enabled: enabled.has(entry.name), available: true
        }))
    };
  }
  if (operation === 'describe') {
    const { names } = requestedTools(args, catalog);
    if (names.length !== 1) throw new Error('INVALID_ARGUMENTS: describe requires exactly one name');
    const entry = catalog.get(names[0]);
    if (!entry) throw unknownToolError(names[0]);
    return { name: bareToolName(entry.name), description: entry.description, inputSchema: entry.inputSchema };
  }
  const { requested, names } = requestedTools(args, catalog);
  // Every name this tool reports back is the bare desktop name the agent typed,
  // never the internal `windows_computer_use_` spelling.
  const bare = list => (list || []).map(bareToolName);
  if (operation === 'reset') {
    if (requested.length) throw new Error('INVALID_ARGUMENTS: reset takes no names');
    const outcome = scopes.reset(exec);
    return { mode, scope: outcome.scope, reset: bare(outcome.removed), errors: outcome.errors.map(error => ({ ...error, name: bareToolName(error.name) })), enabled: bare(outcome.enabled) };
  }
  if (operation !== 'enable' && operation !== 'disable') throw new Error(`INVALID_ARGUMENTS: unknown operation ${operation}`);
  if (!names.length) throw new Error('INVALID_ARGUMENTS: enable/disable requires names');
  for (const name of names) if (!catalog.has(name)) throw unknownToolError(name);
  const outcome = operation === 'enable' ? scopes.enable(names, exec) : scopes.disable(names, exec);
  const described = scopes.describe(exec);
  const loaded = new Set(described.tools.map(entry => entry.name));
  const payload = {
    mode,
    scope: outcome.scope,
    [operation === 'enable' ? 'loaded' : 'removed']: bare(outcome.loaded ?? outcome.removed),
    ...(operation === 'enable' ? { already: bare(outcome.already) } : { missing: bare(outcome.missing) }),
    errors: outcome.errors.map(error => ({ ...error, name: bareToolName(error.name) })),
    enabled: [...loaded].map(bareToolName),
    tools: [...catalog.values()].map(entry => ({
      name: bareToolName(entry.name), description: entry.description,
      enabled: loaded.has(entry.name), available: true
    }))
  };
  if (outcome.errors.length) payload.nextStep = 'The failed names were not enabled; report their messages instead of retrying blindly.';
  else if (outcome.scope !== 'session') payload.nextStep = 'These tools were registered in the context-global layer, so every conversation sees them; this call did not carry a conversation of its own.';
  else payload.nextStep = 'The enabled tools appear in this conversation on its next step.';
  return payload;
}
export async function apply(ctx, config) {
  const mcp = await import('@deepseek-ai/dsh-mcp-client');
  const root = mkdtempSync(path.join(os.tmpdir(), 'dsh-computer-use-'));
  const runtime = { configFile: path.join(root,'settings.json'), stateFile: path.join(root,'state.json'), activityFile:path.join(root,'activity.json') };
  // Reset settings go to the DSH log and, through the server, into the health
  // and tools results the agent reads. Which duplicate's tools DSH keeps is
  // up to the host, so a duplicate entry is reported in the log only.
  const self = {};
  if (config?.[REPAIRED_SETTINGS]?.length) {
    runtime.notices = { settingsRepaired: [...config[REPAIRED_SETTINGS]] };
    ctx.logger.warn('dsh-computer-use: saved settings this version does not offer were reset to their defaults: %s', runtime.notices.settingsRepaired.join('; '));
  }
  liveAdapters.add(self); ctx.effect(() => () => { liveAdapters.delete(self); });
  if (liveAdapters.size > 1) ctx.logger.warn('dsh-computer-use: %d entries of this plugin run in one profile, and both register the same mcp__dsh-computer-use tool names. Remove the extra entry from dsh.profile.bundles in the profile package.json or from its cordis.patch.yml.', liveAdapters.size);
  installActivity(ctx,runtime.activityFile);
  let desired = normalizeSettings(config);
  let runningSelection, session, started = false, stopped = false, instructions = '', toolCallTimeout = 90000;
  let updates = Promise.resolve();
  atomicJson(runtime.configFile, desired);
  ctx.effect(() => () => { stopped = true; });
  // Server context parity with the bridge: the wiki resources and the routing
  // instructions stay attributed to this MCP server name.
  const serverName = 'dsh-computer-use';
  ctx.inject(['systemPrompt'], inner => {
    if (typeof inner.systemPrompt?.section !== 'function') return;
    inner.systemPrompt.section({
      name: `mcp:${serverName}`,
      order: inner.systemPrompt.getSectionOrder('MCP_SERVERS'),
      interpolate: false,
      text: () => instructions
    });
  });
  ctx.inject(['mcpResources'], inner => {
    if (typeof inner.mcpResources?.register !== 'function') return;
    inner.mcpResources.register(serverName, {
      async request(request, exec) {
        const current = session;
        if (!current) throw new Error(`${serverName}: the MCP server is not connected`);
        const options = { signal: exec?.signal, timeoutMs: toolCallTimeout };
        switch (request.method) {
          case 'resources/list': return await current.client.listResources(options);
          case 'resources/templates/list': return await current.client.listResourceTemplates(options);
          case 'resources/read': return await current.client.readResource(request.uri, options);
          default: throw new Error(`${serverName}: unsupported resource request ${request.method}`);
        }
      }
    });
  });
  /** Start one server generation and publish its startup tools. */
  const mount = async settings => {
    const bridge = bridgeConfig({ ...config, ...settings }, runtime);
    toolCallTimeout = bridge.toolCallTimeoutMs;
    const client = new StdioMcpClient({
      serverName: bridge.serverName, command: bridge.command, args: bridge.args,
      env: { ...process.env, ...bridge.env }, timeoutMs: bridge.toolCallTimeoutMs, logger: ctx.logger
    });
    const disposers = [];
    let scopes;
    try {
      await client.start();
      const listed = await client.listTools({ timeoutMs: bridge.toolCallTimeoutMs });
      const advertised = Array.isArray(listed?.tools) ? listed.tools.filter(tool => tool?.name && tool.inputSchema) : [];
      const catalog = await loadCatalog(client, advertised, { timeoutMs: bridge.toolCallTimeoutMs, logger: ctx.logger });
      const definitions = new Map();
      const buildDefinition = rawName => {
        if (definitions.has(rawName)) return definitions.get(rawName);
        const entry = catalog.get(rawName);
        if (!entry) return undefined;
        const definition = mcp.createMcpToolDefinition(ctx, {
          name: publicToolName(bridge.serverName, rawName), rawName,
          description: entry.description, inputSchema: entry.inputSchema,
          call: (args, exec) => client.callTool(rawName, args, { signal: exec.signal, timeoutMs: bridge.toolCallTimeoutMs })
        });
        definitions.set(rawName, definition);
        return definition;
      };
      scopes = new SessionToolScopes({ tools: ctx.tools, buildDefinition, logger: ctx.logger });
      const startup = [];
      for (const tool of advertised) {
        if (tool.name === MANAGEMENT_TOOL) continue;
        const definition = buildDefinition(tool.name) ?? mcp.createMcpToolDefinition(ctx, {
          name: publicToolName(bridge.serverName, tool.name), rawName: tool.name,
          description: tool.description ?? '', inputSchema: tool.inputSchema,
          call: (args, exec) => client.callTool(tool.name, args, { signal: exec.signal, timeoutMs: bridge.toolCallTimeoutMs })
        });
        const dispose = ctx.tools.register(definition);
        if (typeof dispose === 'function') disposers.push(dispose);
        startup.push(tool.name);
      }
      scopes.seed(startup);
      const management = mcp.createMcpToolDefinition(ctx, {
        name: publicToolName(bridge.serverName, MANAGEMENT_TOOL), rawName: MANAGEMENT_TOOL,
        description: managementDescription(startup.length === 0),
        inputSchema: MANAGEMENT_SCHEMA,
        call: (args, exec) => mcpText(manageTools(args, exec, { scopes, catalog, settings, notices: runtime.notices }))
      });
      const disposeManagement = ctx.tools.register(management);
      if (typeof disposeManagement === 'function') disposers.push(disposeManagement);
      const text = typeof client.instructionsText === 'string' ? client.instructionsText : '';
      return {
        client, scopes,
        instructions: () => (text ? `### MCP server: ${bridge.serverName}\n\n${text}` : ''),
        async dispose() {
          scopes.dispose();
          for (const dispose of disposers.reverse()) { try { dispose(); } catch { /* already gone */ } }
          await client.close().catch(() => {});
        }
      };
    } catch (error) {
      scopes?.dispose();
      for (const dispose of disposers.reverse()) { try { dispose(); } catch { /* already gone */ } }
      await client.close().catch(() => {});
      throw error;
    }
  };
  const stopSession = async () => {
    const current = session;
    session = undefined; instructions = '';
    if (!current) return;
    try { await current.dispose(); } catch (error) { ctx.logger.warn(`dsh-computer-use: stopping the MCP server failed: ${errorText(error)}`); }
  };
  // A tool-selection change must not cut an action the desktop is running.
  const waitForIdle = async () => {
    const deadline = Date.now() + 65000;
    for (;;) {
      let active = false;
      try { active = JSON.parse(readFileSync(runtime.stateFile,'utf8')).active > 0; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!active || stopped) return;
      if (Date.now() > deadline) throw new Error('Tool selection change is waiting for the current desktop action to finish');
      await new Promise(resolve => setTimeout(resolve,100));
    }
  };
  const sync = async () => {
    if (stopped) return;
    const selection = toolSelectionKey(desired);
    if (started && runningSelection === selection) return;
    if (started) {
      await waitForIdle();
      if (stopped) return;
      await stopSession();
      started = false;
    }
    const next = await mount(desired);
    if (stopped) { await next.dispose(); return; }
    session = next; instructions = next.instructions();
    started = true; runningSelection = selection;
  };
  const schedule = () => {
    const pending = updates.then(sync);
    updates = pending.catch(() => {});
    return pending;
  };
  const applySettings = next => {
    const nextSettings = normalizeSettings(next);
    atomicJson(runtime.configFile, nextSettings);
    // Windows readers can briefly deny replacement. Keep desired unchanged
    // on a failed write so the next poll retries the pending settings.
    desired = nextSettings;
    return schedule();
  };
  // Volatile references belong to this adapter. Keep their polling lifetime
  // with the owner rather than a settings-service injection child.
  ctx.effect(() => {
    const timer = setInterval(()=>{
      // Older validators keep plain values rather than volatile references.
      // The Loader still commits the validated raw options for those hosts.
      // The raw entry still holds any value the validator reset; reset it here too.
      try {const next=normalizeSettings({...config,...repairStaleSettings(ctx.fiber.entry?.options?.config).value});if(JSON.stringify(next)!==JSON.stringify(desired))applySettings(next).catch(error=>ctx.logger.error(error));}
      catch(error){ctx.logger.error(error);}
    },250);
    timer.unref(); return ()=>clearInterval(timer);
  });
  ctx.effect(() => () => { stopped = true; void stopSession(); });
  ctx.inject(['settings'], settingsContext => {
    if (typeof settingsContext.settings.register !== 'function') {
      // DSH 0.2 uses volatile Config fields keyed by the profile entry id.
      if (settingsContext.settings.configure) settingsContext.effect(()=>settingsContext.settings.configure({auto:false},ctx.fiber));
      return;
    }
    const scope = settingsContext.settings.register('dsh-computer-use', SettingsConfig, {
      base: normalizeSettings(config), applies: 'live', validate: normalizeSettings
    });
    desired = normalizeSettings(scope.get()); atomicJson(runtime.configFile, desired);
    settingsContext.effect(() => scope.watch(applySettings));
    if (started) return applySettings(desired);
  });
  try {
    await schedule();
  } catch (error) {
    if (config?.failOnStartupError) throw new Error('dsh-computer-use: the MCP server or its tool catalogue did not start', { cause: error });
    ctx.logger.warn(`dsh-computer-use: the MCP server did not start: ${errorText(error)}`);
  }
  // Derive the running selection from the generation that actually started.
  runningSelection = started ? toolSelectionKey(desired) : undefined;
}
