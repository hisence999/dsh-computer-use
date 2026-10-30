// Plugin-owned MCP stdio connection to mcp/server.mjs.
//
// This plugin used to reach its MCP server through @deepseek-ai/dsh-mcp-client.
// That bridge registers every tool on its own plugin context, which is the
// context-global tool layer: one activation inside one conversation published
// the tool to every conversation, and the server's enable/disable flipped the
// same global advertisement. Owning the connection keeps the protocol here,
// next to the code that decides which conversation may see a tool.
//
// Framing: the server accepts both `Content-Length` headers and newline
// delimited JSON, and answers in whichever mode its client used. This client
// always writes one JSON message per line, so the server stays in line mode.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { StringDecoder } from 'node:string_decoder';

const PROTOCOL_VERSION = '2024-11-05';
const CLIENT_VERSION = createRequire(import.meta.url)('../package.json').version;
const STDERR_TAIL_BYTES = 4000;
const STARTUP_TIMEOUT_MS = 60000;

/** Rejection shape for a call the host cancelled through `exec.signal`. */
function cancelled(serverName) {
  return Object.assign(new Error(`${serverName}: the tool call was cancelled`), { name: 'AbortError', code: 'MCP_CANCELLED' });
}

export class StdioMcpClient {
  constructor(options = {}) {
    this.serverName = options.serverName || 'mcp';
    this.command = options.command;
    this.args = [...(options.args || [])];
    this.env = options.env || {};
    this.cwd = options.cwd || undefined;
    this.timeoutMs = options.timeoutMs || 60000;
    this.logger = options.logger || { info() {}, warn() {} };
    this.child = null;
    this.decoder = new StringDecoder('utf8');
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
    this.serverInfo = null;
    this.capabilities = {};
    this.instructionsText = '';
    this.stderrTail = '';
    this.closed = false;
    this.closing = null;
  }

  get running() {
    return !this.closed && this.child !== null;
  }

  /** Spawn the server and complete the MCP `initialize` handshake. */
  async start() {
    if (this.child) throw new Error(`${this.serverName}: the MCP connection was already started`);
    const child = spawn(this.command, this.args, {
      cwd: this.cwd, env: this.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
    });
    this.child = child;
    child.stdout.on('data', chunk => this.ingest(this.decoder.write(chunk)));
    child.stderr.on('data', chunk => this.captureStderr(chunk));
    child.on('error', error => this.fail(error));
    child.on('exit', (code, signal) => this.exited(code, signal));
    child.stdin.on('error', error => this.fail(error));
    const result = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'dsh-computer-use', version: CLIENT_VERSION }
    }, { timeoutMs: STARTUP_TIMEOUT_MS });
    this.serverInfo = result?.serverInfo ?? null;
    this.capabilities = result?.capabilities ?? {};
    this.instructionsText = typeof result?.instructions === 'string' ? result.instructions.trimEnd() : '';
    this.notify('notifications/initialized');
    return this;
  }

  /** One JSON-RPC request, bounded by `timeoutMs` and cancellable by `signal`. */
  request(method, params, options = {}) {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const signal = options.signal;
    if (!this.running) return Promise.reject(new Error(`${this.serverName}: the MCP server is not running`));
    if (signal?.aborted) return Promise.reject(cancelled(this.serverName));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (settle, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (onAbort) signal.removeEventListener('abort', onAbort);
        this.pending.delete(id);
        settle(value);
      };
      const timer = setTimeout(() => {
        this.notify('notifications/cancelled', { requestId: id, reason: 'timeout' });
        finish(reject, Object.assign(new Error(`${this.serverName}: ${method} timed out after ${timeoutMs} ms`), { code: 'MCP_TIMEOUT' }));
      }, timeoutMs);
      timer.unref?.();
      const onAbort = signal && typeof signal.addEventListener === 'function' ? () => {
        this.notify('notifications/cancelled', { requestId: id, reason: 'cancelled' });
        finish(reject, cancelled(this.serverName));
      } : undefined;
      if (onAbort) signal.addEventListener('abort', onAbort, { once: true });
      this.pending.set(id, { resolve: value => finish(resolve, value), reject: error => finish(reject, error) });
      try {
        this.write({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  notify(method, params) {
    if (!this.running) return;
    try {
      this.write({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) });
    } catch {
      // A notification for a call that already failed is not worth reporting.
    }
  }

  callTool(rawName, args, options) {
    return this.request('tools/call', { name: rawName, arguments: args ?? {} }, options);
  }

  listTools(options) {
    return this.request('tools/list', {}, options);
  }

  listResources(options) {
    return this.request('resources/list', {}, options);
  }

  listResourceTemplates(options) {
    return this.request('resources/templates/list', {}, options);
  }

  readResource(uri, options) {
    return this.request('resources/read', { uri }, options);
  }

  /** Terminate the child and fail everything still waiting on it. */
  close() {
    if (this.closing) return this.closing;
    this.closed = true;
    this.closing = (async () => {
      this.rejectPending(new Error(`${this.serverName}: the MCP connection was closed`));
      const child = this.child;
      this.child = null;
      if (!child) return;
      const exited = new Promise(resolve => child.once('exit', resolve));
      try {
        child.stdin.end();
      } catch {
        // Already gone.
      }
      const grace = setTimeout(() => {
        try { child.kill(); } catch { /* already exited */ }
      }, 2000);
      grace.unref?.();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 6000))]);
      clearTimeout(grace);
    })();
    return this.closing;
  }

  write(message) {
    const child = this.child;
    if (!child || !child.stdin || child.stdin.destroyed) throw new Error(`${this.serverName}: the MCP server is not running`);
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  ingest(text) {
    if (!text) return;
    this.buffer += text;
    let index;
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        this.logger.warn(`${this.serverName}: ignoring a malformed stdout line: ${error.message}`);
        continue;
      }
      this.handle(message);
    }
    // A peer that never terminates a line must not grow without bound.
    if (this.buffer.length > 4 * 1024 * 1024) this.buffer = '';
  }

  handle(message) {
    if (message === null || typeof message !== 'object') return;
    if (typeof message.method === 'string' && message.id !== undefined) {
      // The server never issues requests; refuse instead of leaving it hanging.
      try {
        this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
      } catch { /* closed */ }
      return;
    }
    if (message.id === undefined) return;
    const entry = this.pending.get(message.id);
    if (!entry) return;
    if (message.error) {
      const text = typeof message.error?.message === 'string' ? message.error.message : 'the request failed';
      entry.reject(Object.assign(new Error(text), { code: 'MCP_ERROR', rpcCode: message.error?.code }));
    } else {
      entry.resolve(message.result);
    }
  }

  captureStderr(chunk) {
    const text = this.decoder.write(chunk);
    this.stderrTail = (this.stderrTail + text).slice(-STDERR_TAIL_BYTES);
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) this.logger.info(`[${this.serverName}] ${line.trim()}`);
    }
  }

  rejectPending(error) {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const entry of entries) entry.reject(error);
  }

  fail(error) {
    this.rejectPending(error instanceof Error ? error : new Error(String(error)));
  }

  exited(code, signal) {
    const wasClosed = this.closed;
    this.child = null;
    this.closed = true;
    const tail = this.stderrTail.split(/\r?\n/).filter(line => line.trim()).slice(-3).join(' | ');
    const reason = `the MCP server exited (code ${code}${signal ? `, signal ${signal}` : ''})${tail ? `: ${tail}` : ''}`;
    if (!wasClosed) this.logger.warn(`${this.serverName}: ${reason}`);
    this.rejectPending(new Error(`${this.serverName}: ${reason}`));
  }
}
