// Real-host check: does a lazy activation stay inside the conversation that
// asked for it?
//
// This boots the plugin on a genuine @deepseek-ai/cordis Context with the real
// ToolRuntime and dsh-scope, mints two agent scopes the way the agent loop does,
// and drives the management tool through `tools.execute()` with each scope. It
// needs the installed DSH node_modules, so it is a manual suite:
//
//   node test/session-scope-host.mjs <installed dsh node_modules>
//
// Without that argument it reports SKIP and exits successfully, which keeps the
// CI suite list unchanged.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modules = process.argv[2] || process.env.DSH_MODULES;
if (!modules) {
  console.log('SKIP session-scope-host: pass the installed DSH node_modules directory');
  process.exit(0);
}

const require = createRequire(path.join(modules, '..', 'package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const [{ Context }, { ToolRuntime }, { createScope }] = await Promise.all([
  load('@deepseek-ai/cordis'),
  load('@deepseek-ai/dsh-tools'),
  load('@deepseek-ai/dsh-scope')
]);
// The plugin resolves its MCP projection helper as a peer, exactly as it does in
// a profile: give the fixture the peer packages instead of the checkout.
const root = await mkdtemp(path.join(os.tmpdir(), 'dcu-session-scope-'));
const packageRoot = path.join(root, 'plugin');
const peerRoot = path.join(packageRoot, 'node_modules', '@deepseek-ai');
await mkdir(peerRoot, { recursive: true });
for (const entry of ['mcp', 'scripts', 'package.json']) await cp(new URL(`../${entry}`, import.meta.url), path.join(packageRoot, entry), { recursive: true });
for (const name of ['schemastery', 'cosmokit', 'dsh-mcp-client']) await symlink(path.dirname(require.resolve(`@deepseek-ai/${name}/package.json`)), path.join(peerRoot, name), 'junction');
const plugin = await import(pathToFileURL(path.join(packageRoot, 'mcp/dsh-plugin.mjs')).href);

const MANAGEMENT = 'mcp__dsh-computer-use__windows_computer_use_tools';
const toolName = raw => `mcp__dsh-computer-use__windows_computer_use_${raw}`;

const ctx = new Context();
ctx.provide('systemPrompt', { tools() { return () => {}; }, section() { return () => {}; }, getSectionOrder() { return 0; } });
const tools = new ToolRuntime(ctx);
const until = async (test, label) => {
  const deadline = Date.now() + 120000;
  while (!(await test())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
const textOf = result => {
  const block = Array.isArray(result?.content) ? result.content.find(entry => entry?.type === 'text') : undefined;
  return block?.text ?? JSON.stringify(result);
};
const scopes = [];
const fiber = ctx.plugin(plugin, { mode: 'lite', toolPreset: 'lazy', indicatorEnabled: false, failOnStartupError: true });
try {
  await fiber;
  await until(() => tools.get(MANAGEMENT) !== undefined, 'the lazy management tool');
  assert.equal(tools.schemas().length, 1, 'Lazy startup advertises the management tool only');

  const agentA = { id: 'session-a' };
  const agentB = { id: 'session-b' };
  const scopeA = createScope(ctx, agentA);
  const scopeB = createScope(ctx, agentB);
  agentA.ctx = scopeA.ctx;
  agentB.ctx = scopeB.ctx;
  scopes.push(scopeA, scopeB);

  const run = async (agent, args) => {
    const callId = `scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await tools.execute({ callId, name: MANAGEMENT, arguments: args, signal: new AbortController().signal, ...(agent ? { agent } : {}) });
    if (result?.isError) console.error('management tool failed:', JSON.stringify(result).slice(0, 1500));
    assert.ok(!result?.isError, textOf(result));
    return JSON.parse(textOf(result));
  };
  const visible = (raw, agent) => tools.get(toolName(raw), agent) !== undefined;
  const globallyVisible = raw => tools.get(toolName(raw)) !== undefined;

  // 1. A conversation enables a tool: it must appear for that conversation only.
  const enabledA = await run(agentA, { operation: 'enable', names: ['click'] });
  assert.deepEqual(enabledA.loaded, ['click'], 'The conversation loads the tool');
  assert.equal(enabledA.scope, 'session', 'The registration is reported as session-scoped');
  assert.ok(visible('click', agentA), 'The activating conversation sees the tool');
  assert.ok(!globallyVisible('click'), 'The tool must not enter the context-global layer');
  assert.ok(!visible('click', agentB), 'Another conversation must not see the tool');
  assert.equal(tools.schemas().length, 1, 'The global schema view is unchanged');

  // 2. Both conversations may expose the same tool independently.
  const enabledB = await run(agentB, { operation: 'enable', names: ['click', 'type_text'] });
  assert.deepEqual(enabledB.loaded, ['click', 'type_text']);
  assert.ok(visible('click', agentB) && visible('type_text', agentB));
  assert.ok(!visible('type_text', agentA), 'Conversation A does not inherit B\'s activation');
  assert.ok(!globallyVisible('type_text'));

  // 3. Enabling again is idempotent, not a duplicate-registration error.
  const againA = await run(agentA, { operation: 'enable', names: ['click'] });
  assert.deepEqual(againA.already, ['click']);
  assert.deepEqual(againA.loaded, []);

  // 4. Disabling only touches the caller.
  const disabledA = await run(agentA, { operation: 'disable', names: ['click'] });
  assert.deepEqual(disabledA.removed, ['click']);
  assert.ok(!visible('click', agentA));
  assert.ok(visible('click', agentB), 'The sibling conversation keeps its registration');

  // 5. Reset is per conversation.
  const resetB = await run(agentB, { operation: 'reset' });
  assert.deepEqual([...resetB.reset].sort(), ['click', 'type_text']);
  assert.ok(!visible('click', agentB) && !visible('type_text', agentB));
  assert.ok(!globallyVisible('click'));

  // 6. A call with no agent cannot be session-scoped: it must say so and land
  //    globally instead of pretending.
  const degraded = await run(undefined, { operation: 'enable', names: ['scroll'] });
  assert.deepEqual(degraded.loaded, ['scroll']);
  assert.equal(degraded.scope, 'global');
  assert.match(String(degraded.nextStep ?? ''), /context-global layer[\s\S]*every conversation/i, 'The degraded scope is disclosed');
  assert.ok(globallyVisible('scroll'), 'The honest fallback is readable without an agent');
  assert.ok(visible('scroll', agentA), 'A global registration is inherited by conversations');
  await run(undefined, { operation: 'disable', names: ['scroll'] });
  assert.ok(!globallyVisible('scroll'));

  // 7. The catalog is what makes a definition buildable before it is advertised.
  const catalog = await run(agentA, { operation: 'catalog' });
  assert.ok(Array.isArray(catalog.tools) && catalog.tools.length > 20, 'Catalog returns every allowed descriptor');
  assert.ok(catalog.tools.every(entry => typeof entry.name === 'string' && entry.inputSchema), 'Each descriptor carries its schema');

  console.log(JSON.stringify({
    passed: true,
    host: require('@deepseek-ai/dsh/package.json').version,
    lazyStartupSchemas: 1,
    sessionIsolation: true,
    siblingIsolation: true,
    globalLayerUntouched: true,
    idempotentEnable: true,
    perConversationReset: true,
    disclosedGlobalFallback: true,
    catalogDescriptors: true,
    physicalInputSent: false
  }, null, 2));
} finally {
  for (const scope of scopes) await scope.dispose();
  await ctx.fiber.dispose();
}
