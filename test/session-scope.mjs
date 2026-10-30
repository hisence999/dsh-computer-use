// Session-scoped tool exposure: the ledger that keeps a lazy activation inside
// the conversation that asked for it.
//
// The real host keys tool layers by the calling agent (`tools.get(name)` is the
// context-global view, `tools.get(name, agent)` the chain that agent sees), and
// a duplicate registration on ONE layer is a hard error. This suite pins that
// contract against a registry with the same shape, so a change that starts
// leaking activations into other conversations fails here without a host.
import assert from 'node:assert/strict';
import { SessionToolScopes, agentOf, scopedToolsOf } from '../mcp/session-tools.mjs';

const PREFIX = 'windows_computer_use_';
const publicName = raw => `mcp__dsh-computer-use__${PREFIX}${raw}`;

/** Registry with the layer split of the host: global map plus per-agent maps. */
class HostTools {
  constructor() {
    this.global = new Map();
    this.layers = new Map();
    this.registrations = 0;
  }
  layerFor(agent) {
    if (agent === undefined) return this.global;
    let layer = this.layers.get(agent);
    if (!layer) {
      layer = new Map();
      this.layers.set(agent, layer);
    }
    return layer;
  }
  registerInto(agent, definition) {
    const layer = this.layerFor(agent);
    if (layer.has(definition.name)) throw new Error(agent === undefined
      ? `tool "${definition.name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)`
      : `tool "${definition.name}" is already registered in this scope`);
    layer.set(definition.name, definition);
    this.registrations += 1;
    return () => layer.delete(definition.name);
  }
  register(definition) {
    return this.registerInto(undefined, definition);
  }
  get(name, agent) {
    if (agent === undefined) return this.global.get(name);
    return this.layerFor(agent).get(name) ?? this.global.get(name);
  }
  scoped(agent) {
    return {
      register: definition => this.registerInto(agent, definition),
      get: name => this.get(name, agent)
    };
  }
  count() {
    let total = this.global.size;
    for (const layer of this.layers.values()) total += layer.size;
    return total;
  }
}

const catalog = new Map([...['click', 'scroll', 'type_text', 'ocr'].map(raw => [raw, { name: publicName(raw), description: raw, parameters: { type: 'object', properties: {} } }])]);
const tools = new HostTools();
const scopes = new SessionToolScopes({ tools, buildDefinition: raw => catalog.get(raw) });

const sessionA = { id: 'session-a' };
const sessionB = { id: 'session-b' };
sessionA.ctx = { tools: tools.scoped(sessionA) };
sessionB.ctx = { tools: tools.scoped(sessionB) };
const execA = { agent: sessionA, signal: new AbortController().signal };
const execB = { agent: sessionB, signal: new AbortController().signal };
const unowned = {};

const raw = name => publicName(name);
const seesGlobally = name => tools.get(raw(name)) !== undefined;
const seesAs = (name, exec) => tools.get(raw(name), exec.agent) !== undefined;

// The plugin registers its startup selection on its own context.
scopes.seed(['ocr']);
tools.register(catalog.get('ocr'));

// 1. A host that hands out no agent must still work, and must say so.
const sharedEnable = scopes.enable(['click'], unowned);
assert.deepEqual(sharedEnable.loaded, ['click'], 'A call without an agent still enables the tool');
assert.equal(sharedEnable.scope, 'global', 'A call without an agent can only fall back to the global layer');
assert.ok(seesGlobally('click'), 'The fallback registration is readable without an agent');

// 2. Idempotent per layer, including names a preset already exposed at startup.
assert.deepEqual(scopes.enable(['click'], unowned).already, ['click'], 'Re-enabling the same name is reported, not re-registered');
assert.deepEqual(scopes.enable(['ocr'], execA).already, ['ocr'], 'Startup tools count as already exposed');

// 3. Session activation lands in that conversation only.
const enableA = scopes.enable(['type_text', 'scroll'], execA);
assert.deepEqual(enableA.loaded, ['type_text', 'scroll']);
assert.equal(enableA.scope, 'session');
assert.ok(seesAs('type_text', execA), 'The activating conversation sees the tool');
assert.ok(!seesGlobally('type_text'), 'Another conversation must not inherit it through the global layer');
assert.ok(!seesAs('type_text', execB), 'A sibling conversation must not see it');

// 4. Two conversations may expose the same name independently.
const enableB = scopes.enable(['type_text'], execB);
assert.deepEqual(enableB.loaded, ['type_text']);
assert.ok(seesAs('type_text', execB));
assert.equal(tools.count(), 5, 'global ocr + global click + A:2 + B:1');

// 5. Disabling only touches the caller's exposure.
const disableA = scopes.disable(['scroll'], execA);
assert.deepEqual(disableA.removed, ['scroll']);
assert.ok(!seesAs('scroll', execA), 'The caller loses the tool');
assert.ok(seesAs('type_text', execA), 'Siblings in the same conversation survive');
assert.ok(seesAs('type_text', execB), 'The other conversation keeps its own registration');
assert.deepEqual(scopes.disable(['scroll'], execA).missing, ['scroll'], 'Disabling twice reports it as missing');

// 6. Reset is per exposure.
scopes.reset(execA);
assert.deepEqual(scopes.describe(execA).tools, [], 'Reset clears the calling conversation');
assert.ok(seesAs('type_text', execB), 'Reset in one conversation leaves the other alone');
assert.ok(seesGlobally('click'), 'Reset never touches another exposure');

// 7. Failures are reported per name and do not abort the batch.
const failing = new SessionToolScopes({
  tools,
  buildDefinition: rawName => {
    if (rawName === 'explode') throw new Error('descriptor unavailable');
    return catalog.get(rawName);
  }
});
const mixed = failing.enable(['explode', 'missing_tool', 'ocr'], execB);
assert.deepEqual(mixed.loaded, ['ocr'], 'The usable name in a failing batch still loads');
assert.deepEqual(mixed.errors.map(error => error.name), ['explode', 'missing_tool']);
assert.match(mixed.errors[0].message, /descriptor unavailable/);
assert.match(mixed.errors[1].message, /Unknown tool/);

// 8. An agent whose context cannot supply a registry degrades to the global
//    layer instead of pretending the registration was session-scoped.
const broken = { id: 'session-broken' };
Object.defineProperty(broken, 'ctx', { get() { throw new Error('cannot get property "tools" without inject'); } });
assert.equal(scopedToolsOf(broken), undefined, 'An unreadable agent context is treated as no session registry');
const degraded = scopes.enable(['click'], { agent: broken });
assert.deepEqual(degraded.already, ['click']);
const degraded2 = scopes.enable(['type_text'], { agent: broken });
assert.equal(degraded2.scope, 'global');
assert.ok(seesGlobally('type_text'), 'The degraded path is honest about landing globally');

// 9. Scope helpers refuse values that are not agent objects.
assert.equal(agentOf({ agent: 'session-a' }), undefined);
assert.equal(agentOf(undefined), undefined);
assert.equal(scopedToolsOf(undefined), undefined);

// 10. Disposal releases everything this plugin owns, in both layers.
scopes.dispose();
assert.ok(!seesGlobally('type_text'), 'Disposal releases the degraded global registration');
assert.ok(!seesGlobally('click'), 'Disposal releases the unowned fallback registration');
assert.ok(seesGlobally('ocr'), 'Startup registrations belong to the host, not to this ledger');
scopes.dispose();

console.log(JSON.stringify({
  passed: true,
  cases: 10,
  sessionIsolation: true,
  siblingIsolation: true,
  idempotentEnable: true,
  perExposureReset: true,
  failureReporting: true,
  globalFallbackOnMissingAgent: true,
  globalFallbackOnUnreadableAgent: true,
  honestScopeLabels: true,
  disposal: true
}, null, 2));
