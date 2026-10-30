# MCP tools for DeepSeek Harness

The Node server enforces the same schemas returned by tools/list. Unknown properties, wrong types and out-of-range values fail before backend execution. Tool names are prefixed windows_computer_use_; the DSH bridge typically adds mcp__dsh-computer-use__.

## Observation and task verification

Gecko desktop trees now apply the same depth accounting to unnamed Gecko layout panes as Chromium panes: window-scoped reads reach page content at default depths, while desktop overviews remain bounded. This does not claim that every Firefox/ESR provider needs Chromium-style warm-up.

## Launch an application

`windows_computer_use_launch_app` accepts `target` (absolute `.exe`/`.com`/`.lnk`, executable name from PATH/App Paths, exact installed application name or AppUserModelID), optional `arguments`, `workingDirectory`, `activate` and `waitMs` (0–10000, default 1500). Arguments are a Windows command-line string passed directly to the target, not interpreted by a command shell. Command interpreters and script hosts (cmd, PowerShell, pwsh, Windows Terminal, WSL, bash, conhost, wscript, cscript, mshta, rundll32, regsvr32, msiexec, forfiles, schtasks), and shortcuts that start one, take no arguments: such a call fails with `LAUNCH_COMMAND_REFUSED` before anything starts, so launch_app is never a command channel the user cannot see. Installed-app identifiers do not accept arguments or a working directory. URLs and scripts are not launch targets.

The interactive Explorer desktop starts the application with its environment and lifetime. This keeps it alive when the calling tool's kill-on-close Job or MCP server ends; it does not request elevation or change Job limits. An absent Explorer desktop returns an explicit error. `activate:false` requests a nonactivating show and takes a quiet lease, but an application can activate itself. `activate:true` brings the app forward, so it shows the takeover indicator and arms Esc, as activate_window does.

Success is `verification:"dispatched"`, not proof that a window appeared. `observedNewWindows` lists newly observed windows, which may include unrelated applications; identify the intended window with `list_windows` or `wait_for`. Single-instance applications can reuse an existing window. Cancellation after dispatch does not undo launch; observe before retrying.

## Desktop observation details

Prefer scoped UIA observations. find supplements an empty sparse (at most 20 nodes, a heuristic) or incomplete search with OCR, unless ocrFallback:false or controlType is specified. OCR candidates are recognized text and screen coordinates, not UIA ids. Inspect ocr.lines if a literal query misses a placeholder.

Chromium-based windows (Electron, Chrome/Edge, CEF, WebView2) build a page's accessibility tree only after a UIA client reads a property of the page root, the first child of each Chrome_RenderWidgetHostHWND window. The control view skips that empty root, so a tree walk alone can leave such a window at its frame and layout panes. Before a window-scoped snapshot, accessibility_tree, find or element wait_for, the backend reads that root for each visible renderer window and waits for the page tree: at most 1.5 seconds and half of treeTimeoutMs per call. The result then carries webContent with renderers, ready, waitedMs and state: ready, partial, starting (observe again shortly) or unavailable (no page tree after 30 seconds of observations, or an unresponsive renderer). element_info by point and OCR resolveControl warm the window the same way before hit-testing. In window-scoped trees, unnamed Chromium layout panes do not count toward maxDepth, so the default depths reach the page; reported depth values stay structural. Desktop-scoped trees neither warm pages nor change depth counting, so they remain an overview of every window.

screenshot and default OCR do not resolve UIA. An unobstructed foreground window uses a screen crop checked before and after capture; background/covered windows use window-capture fallbacks. OCR resolveControl:true opts into hit-testing; its control may represent the whole page. includeScreenshot:true returns MCP image content. Map image pixels to screen = imageBounds origin + image / imageScale. Screen-region captures report occludedPossible:false only when the foreground, Z-order and geometry checks passed; the last-resort screen fallback reports true.

After a coordinate click, type_text preserves focus. Explicit focusMode:main requests heuristic main-control focus. Input actions only report verification:sent; use wait_for for an expected window, UIA element or literal visible text. A confirmed condition reports verification:observed; truncated UIA absence and occluded OCR are inconclusive. Confirm text that exists only after the desired effect, rather than the same text just typed.

Tree watchdogs allow treeTimeoutMs + 10 seconds. A timeout retires the worker; an independently captured image remains supplemental to the explicit UIA error. Input is never replayed. Queue deadlines begin at actual dispatch. Observed RuntimeIds are cached for five minutes, at most 6000 references, with native owner checks; unknown/stale ids require a scoped re-observation.

No visual model is bundled. A vision-capable caller or external parser can consume screenshot content and send coordinates to the guarded input tools.

## Foreground, pointer and the takeover indicator

Each action uses the least intrusive way that works. Reads (snapshot, accessibility_tree, find, element_info, screenshot, ocr, wait_for), list_windows and wait touch nothing. Element actions run in the background: a Win32 or WinForms button, check box or radio button takes BM_CLICK, a Win32 edit takes EM_REPLACESEL, and other elements use their UI Automation pattern. Some UIA providers bring their window forward or move the pointer to carry out a pattern call (managed Win32 proxies call SetForegroundWindow; a list view item's Invoke double-clicks with the real pointer; Chromium activates its window); the backend gives the foreground and the pointer back at once, unless a menu, list or dialog the call opened is showing. Results then report `foreground` and `pointer`.

Real input (coordinate clicks, pastes, key presses, drags, wheel scrolls) borrows the foreground: the target comes forward for the action, a coordinate click is refused with POINT_COVERED when its point shows a window of another process, and afterwards the pointer goes back where the user left it and the foreground goes back to the window that was in front. The target stays in front while a menu, list or dialog the action opened is showing, with activate:true, and when the user switched windows meanwhile; a pointer the user moved is left where they put it. Keys are sent only after a last check that the target (or a window of its process) is still in front. Bringing a window forward first joins the input of the thread in front, which needs no key press, and falls back to the Alt-key method.

Without a window target, the active window is the window the operation series last gave input to, while it is open, else the foreground window. Input and observations without a target use it, so after the foreground went back to the user they keep to DSH's window; snapshot captures that window when it is behind another one. health.activeWindow still reports the real foreground window.

Reads, list_windows, wait, background dispatch and element actions that start in the background take a quiet lease: they honour a stopped series but show no indicator and arm no global Esc. An element action (invoke, set_value, scroll on an element) or type_text in auto mode that turns out to need real input fails in the background attempt with DCU_NEEDS_INPUT before anything is sent, and the server runs it again with the indicator and Esc. Text DSH pastes carries the clipboard formats that keep it out of clipboard history and the cloud clipboard, and the previous clipboard is restored.

## Published tool contracts

### tools — discovery and on-demand loading

DSH defaults to All (24 desktop tools plus management). Lite includes ten common tools plus management; Custom loads the user's selection. Standalone MCP also defaults to All. `windows_computer_use_tools` accepts `operation: list | describe | catalog | enable | disable | reset` and optional `names`, an array of short or complete tool names. `describe` requires exactly one name and returns its original full description and schema. `catalog` takes no names and returns every allowed descriptor without enabling anything; DSH's own plugin uses it to build definitions only for the tools a conversation actually loads. `enable`/`disable` require names and send a tool-list change notification on changes; inside DSH they act per conversation, so what one conversation loads is invisible to the others and a new conversation starts again from the startup set. Under `reset` the server restores the user's startup set, and DSH clears the conversation's registrations. Invalid names never partially change the list. Discovery does not start PowerShell.

When the startup set is the management entry alone and at least one desktop tool is allowed (Lazy startup), `initialize` returns `instructions` describing the desktop capability and the requirement to enable tools first; that entry's own description states the capability too. A management-only start otherwise leaves no desktop tool name from which a model can infer what this server does. Other startup sets omit `instructions`, including a Custom checklist that allows no desktop tool: enabling one there is refused, so the capability must not be claimed.

See [on-demand tools](../tool-context.md) for bilingual configuration and client compatibility notes. The contracts below describe all desktop capabilities; they are not all injected in Lite mode. Compact advertised prose does not remove their parameter validation.

### health

Check that the Windows UI Automation backend, screenshot capture, and input stack are available.

No arguments.

### snapshot

Capture a screenshot and a UI Automation tree for the active window or desktop. In a Chromium-based window (Electron, Chrome/Edge, CEF, WebView2) the first observation enables the page's accessibility tree; webContent reports whether it is ready.

| Argument | Type | Default / bounds |
|---|---|---|
| scope | string | active_window/desktop; default: "active_window" |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| detailLevel | string | compact/full; default: "compact" |
| treeTimeoutMs | integer | default: 5000; min: 100; max: 30000 |
| includeScreenshot | boolean | default: true |
| captureWindow | boolean | default: false |
| maxWidth | integer | default: 1600; min: 0; max: 7680 |
| maxDepth | integer | default: 5; min: 0; max: 12 |
| maxNodes | integer | default: 250; min: 1; max: 2000 |

### accessibility_tree

Read the UI Automation tree without taking a screenshot. In a Chromium-based window (Electron, Chrome/Edge, CEF, WebView2) the first observation enables the page's accessibility tree; webContent reports whether it is ready.

| Argument | Type | Default / bounds |
|---|---|---|
| scope | string | active_window/desktop; default: "active_window" |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| detailLevel | string | compact/full; default: "compact" |
| treeTimeoutMs | integer | default: 5000; min: 100; max: 30000 |
| maxDepth | integer | default: 6; min: 0; max: 12 |
| maxNodes | integer | default: 500; min: 1; max: 3000 |

### list_windows

List top-level windows visible to Windows UI Automation.

| Argument | Type | Default / bounds |
|---|---|---|
| includeInvisible | boolean | default: false |
| maxWindows | integer | default: 50; min: 1; max: 200 |

### find

Find UIA elements by name, automation id, class, value or type. When UIA is sparse or incomplete and no match is found, automatically read visible text with OCR. OCR candidates have SCREEN coordinates and source:'ocr', not UIA element ids. If the literal query misses, inspect ocr.lines and reformulate using the visible text (a search box may say '大家都在搜').

| Argument | Type | Default / bounds |
|---|---|---|
| query | string | required |
| scope | string | active_window/desktop; default: "active_window" |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| treeTimeoutMs | integer | default: 5000; min: 100; max: 30000 |
| controlType | string |  |
| ocrFallback | boolean | default: true |
| maxDepth | integer | default: 8; min: 0; max: 12 |
| maxNodes | integer | default: 1200; min: 1; max: 5000 |
| maxResults | integer | default: 25; min: 1; max: 200 |

### element_info

Return UI Automation information for an element id or a screen point.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string |  |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| detailLevel | string | compact/full; default: "compact" |
| x | integer |  |
| y | integer |  |

### click

Click a screen coordinate or the center of a UI Automation element. dispatch:'auto' (default) = a left click on an element runs in the background (BM_CLICK on a Win32 button, else its UIA Invoke/Toggle pattern); a coordinate click is real SendInput input: the target comes forward for it, a point that shows another window is refused (POINT_COVERED), then the pointer and the foreground go back; dispatch:'background' = PostMessage into the target window's queue (no foreground steal, delivery unverified — Chromium/Electron/UWP may drop it, then retry with foreground); dispatch:'foreground' = always foreground SendInput. Raw-coordinate clicks home-correct if the target window moved since it was observed (reported as 'homed').

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string |  |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| x | integer |  |
| y | integer |  |
| button | string | left/right/middle; default: "left" |
| dispatch | string | auto/background/foreground; default: "auto" |

### double_click

Double click a screen coordinate or the center of a UI Automation element. Supports the same dispatch modes as click (background posts a real WM_LBUTTONDBLCLK).

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string |  |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| x | integer |  |
| y | integer |  |
| button | string | left/right/middle; default: "left" |
| dispatch | string | auto/background/foreground; default: "auto" |

### move

Move the mouse pointer to a screen coordinate or the center of an element.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string |  |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| x | integer |  |
| y | integer |  |

### drag

Drag through a path of screen coordinates.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| path | array | min items: 2; required |
| button | string | left/right/middle; default: "left" |

### scroll

Scroll at a screen coordinate or an element. An element scrolls in the background first (WM_VSCROLL/WM_HSCROLL on a Win32 control with its own scroll bar, else the UIA ScrollPattern of the element or of its nearest scrolling ancestor) and reports scrollPercent before/after; otherwise the wheel is real input at the point, with the foreground and pointer given back. Positive deltaY scrolls down; 120 is one wheel notch, which scrolls the lines set for the wheel in Windows.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string |  |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| x | integer |  |
| y | integer |  |
| deltaY | integer | default: 480 |
| deltaX | integer | default: 0 |

### type_text

Type text into the focused control of the target (or active) window. method:'auto' (default) = a focused Win32 edit takes the text in the background (EM_REPLACESEL at the caret: no clipboard, keyboard or foreground; text with line breaks is pasted instead); any other control gets a clipboard paste with the window borrowed for it (reliable for CJK; the clipboard is restored and the paste kept out of clipboard history); method:'clipboard' always pastes; method:'sendinput' sends each character as a KEYEVENTF_UNICODE SendInput event (no clipboard, best for ASCII/short text); method:'background' posts WM_CHAR straight into the target window's message queue — no clipboard, no foreground steal, delivery unverified. After a background write, or with a window target and focusMode:'main', the result includes verifyValue (the text control's value after typing, truncated to 200 chars).

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| text | string | required |
| method | string | auto/clipboard/sendinput/background; default: "auto" |
| focusMode | string | preserve/main; default: "preserve" |
| restoreClipboard | boolean | default: true |

### keypress

Press a key or key chord, such as Ctrl+L, Enter, Alt+F4, or Shift+Tab. The Windows key is blocked by design. The keys go to the target (or active) window, which comes forward for them and then gives the foreground back, unless a menu or dialog they opened is showing. dispatch:'background' supports only a single printable character (posted as WM_CHAR into the target window, no foreground steal); chords and functional keys must use dispatch:'foreground' (SendKeys).

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| keys | array | min items: 1; required |
| dispatch | string | foreground/background; default: "foreground" |

### focus

Set keyboard focus to a UI Automation element.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string | required |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |

### invoke

Invoke a UI Automation element in the background: BM_CLICK on a Win32 button, else its Invoke, Toggle, SelectionItem, or ExpandCollapse pattern, with click fallback. action expands, collapses or scrolls the element into view instead: expand/collapse use ExpandCollapse only and leave an element already in that state as it is; scroll_into_view uses ScrollItem, so its container scrolls with no pointer. These actions are for UI Automation elements.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string | required |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| action | string | default/expand/collapse/scroll_into_view; default: "default" |
| fallbackClick | boolean | default: true |

### set_value

Set a value in the background (EM_REPLACESEL on a Win32 edit, else the UI Automation ValuePattern), or focus and type as fallback.

| Argument | Type | Default / bounds |
|---|---|---|
| elementId | string | required |
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| value | string | required |
| fallbackType | boolean | default: true |
| restoreClipboard | boolean | default: true |

### activate_window

Bring a top-level window to the foreground by title substring, process id, or native HWND. This tool always activates its target; the shared activate flag cannot suppress it.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |

### wait

Wait for a short period before observing the UI again.

| Argument | Type | Default / bounds |
|---|---|---|
| milliseconds | integer | default: 500; min: 1; max: 30000 |

### ocr

Read visible text with Windows.Media.Ocr, independent of UIA by default. Returns text, lines and word boxes in SCREEN coordinates. query is literal text matching, not semantic recognition; inspect lines if 'search' misses a placeholder. Click matched.word.x/y using foreground dispatch, then type_text with focusMode:'preserve'. Optional resolveControl performs a potentially blocking UIA hit-test; its control may be the whole page rather than the text input.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| scope | string | active_window/desktop; default: "active_window" |
| maxWidth | integer | default: 1920; min: 0; max: 7680 |
| resolveControl | boolean | default: false |
| includeScreenshot | boolean | default: false |
| query | string |  |

### screenshot

Capture a window or desktop without querying UIA. Returns an image plus bounds and imageScale for mapping image pixels to SCREEN coordinates: screen = bounds origin + image / imageScale. Use when the accessibility provider is unavailable, or to locate icons visually. Capture does not prove an action succeeded; inspect the resulting state.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| scope | string | active_window/desktop; default: "active_window" |
| maxWidth | integer | default: 1600; min: 0; max: 7680 |

### wait_for

Wait for a window, a UIA element, or literal visible OCR text to appear/disappear. condition:'window' uses native window enumeration; 'element' uses a bounded UIA query; 'text' uses OCR without UIA. Returns verification:'observed' only when the condition was observed; truncated UIA absence is inconclusive. Text is literal, so use the actual expected text, not an inferred semantic label.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| condition | string | window/element/text; default: "window" |
| query | string |  |
| controlType | string |  |
| scope | string | active_window/desktop; default: "active_window" |
| viewMode | string | control/content/raw; default: "control" |
| includeOffscreen | boolean | default: false |
| treeTimeoutMs | integer | default: 1000; min: 100; max: 30000 |
| maxDepth | integer | default: 8; min: 0; max: 12 |
| maxNodes | integer | default: 1200; min: 1; max: 5000 |
| appear | boolean | default: true |
| timeoutMs | integer | default: 5000; min: 100; max: 60000 |
| intervalMs | integer | default: 250; min: 50; max: 5000 |

### close_window

Close a window gracefully by posting WM_CLOSE (the app can veto with a save dialog). Safer than killing the process; use close_window instead of alt+f4 when the app may have unsaved state you want to handle. The shared activate flag is ignored: WM_CLOSE is posted in the background and needs no foreground switch.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |

### move_window

Move (not resize) a window to screen coordinates without activating it. Useful for arranging windows, and it also refreshes the homing cache for coordinate-based actions.

| Argument | Type | Default / bounds |
|---|---|---|
| windowTitle | string |  |
| processId | integer | min: 1 |
| nativeWindowHandle | integer | min: 1 |
| activate | boolean | default: false |
| x | integer | required |
| y | integer | required |
