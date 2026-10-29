export const TOOL_NAMES = Object.freeze(['health','snapshot','accessibility_tree','list_windows','find','element_info','click','double_click','move','drag','scroll','type_text','keypress','focus','invoke','set_value','activate_window','wait','ocr','screenshot','wait_for','close_window','move_window','launch_app','tools']);
export const LITE_TOOL_NAMES = Object.freeze(['list_windows','find','click','scroll','type_text','keypress','ocr','screenshot','wait_for','launch_app','tools']);
export function normalizeEnabledTools(value) {
  if (!Array.isArray(value) || value.length > TOOL_NAMES.length || value.some(name => typeof name !== 'string' || !TOOL_NAMES.includes(name))) throw new Error('enabledTools must be an array of known tool names');
  const selected=new Set(value);
  return TOOL_NAMES.filter(name=>selected.has(name));
}

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'full', toolPreset: 'auto', enabledTools: TOOL_NAMES, indicatorEnabled: true, cursorIndicatorEnabled: true, remoteIndicatorVisible: true, indicatorText: 'DSH 正在控制电脑',
  indicatorPosition: 'top', indicatorIdleMs: 800, stopShortcut: '',
  resumeToken: 0, previewToken: 0
});

export const STOP_SHORTCUT_PATTERN = /^(?:(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?(?:Win\+)?(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Pause|CapsLock|NumLock|ScrollLock))?$/;

export function normalizeStopShortcut(value) {
  if (typeof value !== 'string') throw new Error('stopShortcut must be a string');
  if (!value) return '';
  const parts = value.split('+'), key = parts.pop();
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Win'];
  if (parts.some(part => !modifiers.includes(part)) || new Set(parts).size !== parts.length ||
      !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Pause|CapsLock|NumLock|ScrollLock)$/.test(key)) {
    throw new Error('stopShortcut must be a supported key with optional Ctrl, Alt, Shift, Win modifiers; Esc is always reserved');
  }
  return [...modifiers.filter(part => parts.includes(part)), key].join('+');
}

// A saved value this version does not offer (a tool or preset chosen in another
// version, or edited by hand) must not keep the plugin from loading: DSH
// refuses the whole entry when one value fails, and every tool then disappears
// with no visible error (#39). Such choices fall back to their defaults and
// unknown tool names are dropped; each change is returned so it can be
// reported. Values typed on the settings page (shortcut, text, numbers) stay
// strict, so a mistyped one is still refused when saved.
const SETTING_CHOICES = { mode: ['lite', 'full'], toolPreset: ['auto', 'full', 'lite', 'lazy', 'custom'], indicatorPosition: ['top', 'bottom'] };
const SETTING_SWITCHES = ['indicatorEnabled', 'cursorIndicatorEnabled', 'remoteIndicatorVisible'];
export function repairStaleSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { value: input, repaired: [] };
  const value = { ...input }, repaired = [];
  const read = key => typeof value[key]?.get === 'function' ? value[key].get() : value[key];
  const reset = key => { repaired.push(`${key}: ${JSON.stringify(read(key))}`); delete value[key]; };
  for (const [key, allowed] of Object.entries(SETTING_CHOICES)) if (read(key) != null && !allowed.includes(read(key))) reset(key);
  for (const key of SETTING_SWITCHES) if (read(key) != null && typeof read(key) !== 'boolean') reset(key);
  // Settings this version no longer has at all must not linger in a saved entry.
  for (const key of ['browserFirst', 'browserVisible', 'browserApp', 'browserSignIn', 'communityNote']) if (read(key) != null) reset(key);
  const tools = read('enabledTools');
  if (tools != null && !Array.isArray(tools)) reset('enabledTools');
  else if (tools?.some(name => !TOOL_NAMES.includes(name))) {
    const known = [...new Set(tools.filter(name => TOOL_NAMES.includes(name)))];
    repaired.push(`enabledTools: ${tools.filter(name => !TOOL_NAMES.includes(name)).map(name => JSON.stringify(name)).join(', ')}`);
    // A list made only of unknown names would leave no tool at all.
    if (known.length) value.enabledTools = known; else delete value.enabledTools;
  }
  return { value, repaired };
}

export function normalizeSettings(input = {}) {
  const value = { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(input).map(([key,value])=>[key,typeof value?.get === 'function' ? value.get() : value])) };
  if (!['lite', 'full'].includes(value.mode)) throw new Error('mode must be lite or full');
  value.enabledTools=normalizeEnabledTools(value.enabledTools);
  if (!['auto','full','lite','lazy','custom'].includes(value.toolPreset)) throw new Error('toolPreset must be full, lite, lazy or custom');
  if (value.toolPreset==='auto') value.toolPreset=value.enabledTools.length===TOOL_NAMES.length?'full':'custom';
  for (const key of ['indicatorEnabled', 'cursorIndicatorEnabled','remoteIndicatorVisible']) {
    if (typeof value[key] !== 'boolean') throw new Error(`${key} must be boolean`);
  }
  if (typeof value.indicatorText !== 'string' || !value.indicatorText.trim() || value.indicatorText.length > 120 || /[\r\n\x00-\x1f]/.test(value.indicatorText)) {
    throw new Error('indicatorText must be one line of 1–120 characters');
  }
  if (!['top', 'bottom'].includes(value.indicatorPosition)) throw new Error('indicatorPosition must be top or bottom');
  if (!Number.isInteger(value.indicatorIdleMs) || value.indicatorIdleMs < 200 || value.indicatorIdleMs > 3000) throw new Error('indicatorIdleMs must be 200–3000');
  value.stopShortcut = normalizeStopShortcut(value.stopShortcut);
  for (const key of ['resumeToken', 'previewToken']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) throw new Error(`${key} must be a nonnegative integer`);
  }
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, value[key]]));
}

export function enabledToolsForSettings(input = {}) {
  const settings=normalizeSettings(input);
  return [...(['full','lazy'].includes(settings.toolPreset)?TOOL_NAMES:settings.toolPreset==='lite'?LITE_TOOL_NAMES:settings.enabledTools)];
}

// Both permission and startup state matter when deciding whether to reconnect.
export function toolSelectionKey(input = {}) {
  const settings=normalizeSettings(input);
  return JSON.stringify({allowed:enabledToolsForSettings(settings),lazy:settings.toolPreset==='lazy'});
}

// DSH publishes this text as a system-prompt section attributed to this server.
// It states what the toolset can do and where its limits are, without inventing
// capabilities that a reduced tool selection has turned off.
export function routingInstructions(settings = {}, allowed = enabledToolsForSettings(settings)) {
  const text = ['windows_computer_use_ tools read and operate real Windows applications through UI Automation, screenshots, OCR and native input. Prefer UI Automation elements over screen coordinates, and observe again to verify that an action took effect.',
    'Start with windows_computer_use_list_windows to identify the intended window, then snapshot or accessibility_tree to read it; use screenshot/ocr when a provider is sparse, and type_text only after focusing the right control.'];
  if (!allowed.includes('list_windows')) text.push('Window discovery is disabled in this selection; ask the user for the window title or process instead of inventing one.');
  if (!allowed.includes('set_value')) text.push('set_value is disabled in this selection, so a control can only be filled through focus plus type_text.');
  text.push('Before sending, posting, buying, deleting or changing account settings on the user\'s behalf, ask the user unless they asked for exactly that step. Respect enabled-tool restrictions, permission refusals and the user\'s stop request.');
  text.push('Do not silently replay an action whose outcome is unknown: observe its result first. A refused or disabled control, an invalid value or a cancellation is never a reason to bypass the refusal with another input method.');
  text.push('An action result that reports verification "sent" only means it was dispatched: confirm the expected effect with wait_for or a fresh observation.');
  return text.join(' ');
}
