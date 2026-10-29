// Calls that use neither the user's pointer nor keyboard take a quiet lease: it
// still honours a stopped series, but shows no indicator and arms no Esc stop.
// They are discovery and delays, reads of the screen and of UI Automation, app
// launches (unless activate:true brings a window forward), and element actions
// that start in the background (window messages, UI Automation patterns). One of
// those that turns out to need real input fails with DCU_NEEDS_INPUT before
// sending any, and the server runs it again loudly.
const READS = new Set(['snapshot', 'tree', 'accessibility_tree', 'find', 'element_info', 'screenshot', 'ocr', 'wait_for']);
export const BACKGROUND_FIRST = new Set(['invoke', 'set_value', 'scroll', 'type_text']);
export function isQuietCall(action, args = {}) {
  if (['health', 'list_windows', 'wait'].includes(action)) return true;
  if (!args || args.activate === true) return false;
  if (READS.has(action) || action === 'launch_app') return true;
  // Window messages posted to the target window.
  if ((['click', 'double_click', 'keypress'].includes(action) && args.dispatch === 'background') || (action === 'type_text' && args.method === 'background')) return true;
  // method:'auto' types into a focused Win32 edit with EM_REPLACESEL first.
  if (action === 'type_text') return (args.method ?? 'auto') === 'auto' && args.focusMode !== 'main';
  if (args.elementId === undefined || args.elementId === null) return false;
  if (BACKGROUND_FIRST.has(action)) return true;
  return action === 'click' && (args.dispatch ?? 'auto') === 'auto' && (args.button ?? 'left') === 'left';
}
