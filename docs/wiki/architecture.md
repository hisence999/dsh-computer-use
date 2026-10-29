# Architecture

DSH ToolRuntime calls the official MCP bridge, which starts mcp/server.mjs in Node mode (including Electron via ELECTRON_RUN_AS_NODE). The Node server validates arguments against the same schemas it advertises. One persistent PowerShell backend serializes desktop requests; queued request time is not counted as execution time.

## Observation

UIA trees use cached properties, a node cap, a depth cap and a traversal time budget. One synchronous provider call can still block. The server watchdog allows the budget plus 10 seconds, retires a stuck worker, and may obtain a native screenshot from a replacement. The response preserves explicit failure; an image is not a successful accessibility tree.

Native window enumeration, screenshot, default OCR, coordinate targeting and window management do not resolve UIA elements. Fully on-screen, unobstructed foreground windows use a screen crop, with foreground HWND, Z order and geometry checked before and after capture. Other windows use PrintWindow, Windows.Graphics.Capture and a flagged screen-region fallback. These capture APIs have their own watchdog; UIA independence is not a guarantee that every capture API is interruptible.

Empty sparse/incomplete find results can attach OCR. OCR candidates have source:ocr, recognized text and screen-space bounds. Literal OCR text does not prove a control role. Explicit resolveControl requests a UIA hit-test, whose result may be a whole document. Screenshot image pixels map to screen = bounds origin + image / imageScale.

## Actions and evidence

Each action uses the least intrusive way that works (less takeover, issue #45). Element actions run in the background: BM_CLICK for Win32 buttons, EM_REPLACESEL for Win32 edits, WM_VSCROLL/WM_HSCROLL for controls with their own scroll bars, else the UIA pattern under a guard that gives back the foreground and the pointer a provider took on its own (managed Win32 proxies and Chromium activate their window for most pattern calls), unless a menu, list or dialog the call opened is showing. Real input borrows the foreground: Start-Input notes the window in front and the pointer and brings the target forward (joining the input of the thread in front first, the Alt-key method second); Assert-PointOnTarget refuses a click whose point shows another process's window; Assert-InFront checks once more right before keys go out; Complete-Input, in finally, waits for the target to handle the input (two WM_NULL), then puts the pointer back if it is still where DSH left it and returns the foreground, except with activate:true, while the target's thread is in menu mode or shows a popup that was not there before, or when the user switched windows. The window input went to is remembered with the host's series key (_dcuSeries), so input and observations without a window target keep to it after the foreground went back to the user. type_text preserves the current focus by default, so it can follow an OCR/visual click without refocusing another control. focusMode:main explicitly requests heuristic main-control focus.

The server classifies calls with isQuietCall, shared with the host's activity tracking: reads, list_windows, wait, background dispatch and element actions that start in the background take a quiet lease (no takeover helper, so no indicator and no global Esc), and only a call that uses the real pointer or keyboard turns on the series indicator. Element actions, scroll on an element and type_text in auto mode first run with _dcuQuiet; when they would need real input the backend throws DCU_NEEDS_INPUT before sending any, and the server runs them again with a normal lease.

RuntimeId references are cached from observations with HWND/PID ownership and a five-minute lifetime. Unseen/stale ids require re-observation; the backend does not globally search the desktop for them. Legacy tree paths remain view-dependent.

Actions report verification:sent. A UIA pattern call or native input acceptance does not prove the user's objective. wait_for supports native window presence, bounded UIA element queries, and literal OCR text. A satisfied observable condition reports verification:observed. Truncated UIA absence and occluded OCR remain inconclusive.

Input cancellation allows press/release cleanup before worker retirement. Timed-out input is never replayed. Clipboard data is read before replacement and restored in finally; pasted text carries ExcludeClipboardContentFromMonitorProcessing, CanIncludeInClipboardHistory=0 and CanUploadToCloudClipboard=0, so it stays out of clipboard history and the cloud clipboard. Drag release is also attempted in finally.

## Vision

No visual model is bundled. A vision-capable caller or optional external parser such as OmniParser can consume screenshot content and return coordinates to the same guarded input tools.
