// Client module: DSH React, settings transport, and real navigation slots.
window.__ModuleLoader__.load({
  id: 'dsh-computer-use',
  factory: (require) => {
    const React = require('react'), h = React.createElement;
    const NS = 'dshComputerUse.settings';
    const allToolNames='health snapshot accessibility_tree list_windows find element_info click double_click move drag scroll type_text keypress focus invoke set_value activate_window wait ocr screenshot wait_for close_window move_window launch_app tools'.split(' ');
    const toolGroups=[
      ['observe',[
        ['health','检查连接','Check connection','检查桌面工具是否可用','Check desktop tool availability'],
        ['snapshot','截图与控件概览','Screen and controls','同时查看画面和界面控件','Capture the screen and UI controls'],
        ['accessibility_tree','读取界面控件','Read UI controls','查看窗口里的控件结构','Read the control hierarchy'],
        ['find','查找控件','Find controls','按文字或类型查找控件','Find controls by text or type'],
        ['element_info','查看控件详情','Inspect a control','读取控件属性和可用操作','Read control properties and actions'],
        ['ocr','识别屏幕文字','Read screen text','从画面中识别文字和位置','Recognize visible text and positions'],
        ['screenshot','截取屏幕','Take a screenshot','查看窗口或桌面的画面','Capture a window or desktop']
      ]],
      ['input',[
        ['click','单击','Click','点击控件或屏幕位置','Click a control or screen position'],
        ['double_click','双击','Double-click','双击控件或屏幕位置','Double-click a control or position'],
        ['move','移动鼠标','Move pointer','移动鼠标到指定位置','Move the pointer to a position'],
        ['drag','拖动鼠标','Drag','按指定路径拖动','Drag along a specified path'],
        ['scroll','滚动','Scroll','滚动页面或控件','Scroll a page or control'],
        ['type_text','输入文字','Type text','在当前输入位置填写文字','Enter text at the current focus'],
        ['keypress','按键与组合键','Press keys','发送按键或组合键','Send a key or key combination']
      ]],
      ['windows',[
        ['launch_app','启动应用','Launch an app','通过桌面启动应用，工具结束后仍可使用','Start an app that remains open after the tool exits'],
        ['list_windows','查看窗口列表','List windows','查找已打开的窗口','Find open windows'],
        ['activate_window','切换窗口','Activate a window','将目标窗口切到前台','Bring a window to the foreground'],
        ['move_window','移动窗口','Move a window','调整窗口在屏幕上的位置','Reposition a window'],
        ['close_window','关闭窗口','Close a window','请求应用关闭窗口','Ask an app to close a window'],
        ['focus','聚焦控件','Focus a control','将输入焦点移到控件','Move input focus to a control'],
        ['invoke','执行控件操作','Use a control','调用按钮、选项或展开操作','Invoke, toggle, select or expand a control'],
        ['set_value','设置控件内容','Set a control value','直接填写可编辑控件','Fill an editable control directly']
      ]],
      ['other',[
        ['wait','等待片刻','Wait briefly','等待指定时间后继续','Pause before continuing'],
        ['wait_for','等待目标出现','Wait for a target','等待窗口、控件或文字出现','Wait for a window, control or text'],
        ['tools','工具说明与管理','Tool reference and management','查看说明并管理已获准的工具','Describe and manage user-allowed tools']
      ]]
    ];
    const liteToolNames='list_windows find click scroll type_text keypress ocr screenshot wait_for launch_app tools'.split(' ');
    const defaults = {toolPreset:'full',enabledTools:allToolNames,indicatorEnabled:true,cursorIndicatorEnabled:true,remoteIndicatorVisible:true,indicatorText:'DSH 正在控制电脑',indicatorPosition:'top',indicatorIdleMs:800,stopShortcut:''};
    const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
    const dictionaries = {
      zh: {nav:'电脑操控',title:'Windows 桌面操作',intro:'查看接管提示，使用 Esc 停止桌面操作。',mode:'工具模式',lite:'精简模式',full:'全能模式',modeHint:'精简模式保留常用工具，其余按需加载。切换模式会在当前动作结束后重载工具。',indicator:'显示接管提示',indicatorHint:'显示屏幕边缘光晕和提示条；关闭后仍可按 Esc 停止。',text:'提示文字',position:'提示位置',top:'屏幕顶部',bottom:'屏幕底部',delay:'操作结束后隐藏延时（毫秒）',delayHint:'连续动作共用提示，避免每次点击都闪烁。范围 200–3000 毫秒。',corner:'用鼠标停止操作',cornerHint:'鼠标停在屏幕左上角约 500 毫秒可拒绝后续输入；普通鼠标移动不会停止。',stop:'停止与恢复',stopHint:'用户按 Esc 后保持暂停。普通鼠标和其他按键不触发停止，程序发送的 Esc 也不触发停止。恢复前请确认 agent 的任务仍符合你的意图。',resume:'恢复桌面控制',resumed:'已请求恢复桌面控制',preview:'预览接管提示',previewed:'已请求预览；如果之前按 Esc 暂停，请先恢复控制。',save:'保存',discard:'取消修改',saved:'已保存',failed:'保存失败',unavailable:'当前宿主未提供可写设置，请在本机 DSH 中打开此页面。',invalid:'请填写 1–120 字的单行提示文字，并将隐藏延时设为 200–3000 的整数。',persistFailed:'宿主未确认设置已保存，请刷新后重试。'},
      en: {nav:'Computer Use',title:'DSH computer use',intro:'See when the agent controls your desktop. Press Esc to stop.',mode:'Tool mode',lite:'Lite',full:'Full',modeHint:'Lite keeps common tools and loads others on demand. A mode change reloads tools after the current action finishes.',indicator:'Show takeover indicator',indicatorHint:'Show the screen-edge glow and banner. Esc remains available when the indicator is off.',text:'Banner text',position:'Banner position',top:'Top of screen',bottom:'Bottom of screen',delay:'Hide delay after an action (ms)',delayHint:'Keep the indicator between consecutive actions. Range: 200–3000 ms.',corner:'Keep the mouse-corner failsafe',cornerHint:'Parking the pointer in the top-left corner for about 500 ms can refuse further input. Ordinary mouse movement does not stop control.',stop:'Stop and resume',stopHint:'Physical Esc keeps desktop input paused. Other mouse/keyboard input and agent-generated Esc do not stop control. Check the task before resuming.',resume:'Resume desktop control',resumed:'Desktop control resume requested',preview:'Preview takeover indicator',previewed:'Preview requested; resume first if you previously stopped with Esc.',save:'Save',discard:'Discard changes',saved:'Saved',failed:'Save failed',unavailable:'Writable settings are unavailable. Open this page in your local DSH host.',invalid:'Use 1–120 characters on one line and an integer hide delay between 200 and 3000.',persistFailed:'The host did not confirm the saved settings. Refresh and retry.'}
    };
    const extraCopy={
      zh:{intro:'选择 agent 使用的工具，设置接管提示与停止方式。',toolsTitle:'工具模式',toolsHint:'精简模式覆盖日常操作，需要时可继续加载更多工具。',lite:'精简',full:'全能',liteSummary:'常用工具，减少上下文占用',fullSummary:'启动时提供全部桌面工具',liteCount:'11 个初始工具',fullCount:'25 个初始工具',modeAfter:'切换模式会等当前动作结束后生效。',indicatorTitle:'接管提示',indicator:'显示屏幕边缘与提示条',indicatorHint:'让你知道 agent 何时正在操作电脑。',position:'提示位置',top:'顶部',bottom:'底部',preview:'预览接管提示',previewHint:'请先保存更改，再预览屏幕上的实际效果。',previewOff:'提示已关闭',previewOn:'接管时的屏幕示意',previewNote:'提示不抢焦点，鼠标可以穿透。',appearance:'提示的更多选项',text:'提示文字',delay:'操作后保留提示',delayHint:'连续动作保持显示，减少闪烁。200–3000 毫秒。',stop:'停止与恢复',escTitle:'按 Esc 停止操作',stopHint:'停止后保持暂停，准备好再恢复。普通鼠标移动和其他按键不会停止接管。',resume:'恢复桌面控制',extraStop:'其他停止方式',corner:'用鼠标停止操作',cornerHint:'鼠标在屏幕左上角停留约 500 毫秒后拒绝后续输入；关闭后仍可按 Esc 停止。',save:'保存更改',discard:'放弃更改',dirty:'有未保存的更改',clean:'更改后点击保存',ms:'毫秒'},
      en:{intro:'Choose the agent’s tools and how desktop control is shown and stopped.',toolsTitle:'Tool mode',toolsHint:'Lite covers everyday tasks. More tools can be loaded when needed.',lite:'Lite',full:'Full',liteSummary:'Common tools with less context',fullSummary:'All desktop tools at startup',liteCount:'11 initial tools',fullCount:'25 initial tools',modeAfter:'Mode changes take effect after the current action finishes.',indicatorTitle:'Takeover indicator',indicator:'Show screen edges and a banner',indicatorHint:'See when the agent is operating your computer.',position:'Banner position',top:'Top',bottom:'Bottom',preview:'Preview indicator',previewHint:'Save changes before previewing the actual screen indicator.',previewOff:'Indicator is off',previewOn:'Screen preview during control',previewNote:'The indicator keeps focus and lets clicks pass through.',appearance:'More indicator options',text:'Banner text',delay:'Keep visible after an action',delayHint:'Stay visible between consecutive actions. 200–3000 milliseconds.',stop:'Stop and resume',escTitle:'Press Esc to stop',stopHint:'Control stays paused until you resume. Ordinary mouse movement and other keys do not stop it.',resume:'Resume desktop control',extraStop:'Additional stop option',corner:'Top-left mouse-corner failsafe',cornerHint:'Refuse further input after the pointer stays in the top-left corner for about 500 ms. Turn off to use Esc alone.',save:'Save changes',discard:'Discard changes',dirty:'Unsaved changes',clean:'Save after making changes',ms:'ms'}
    };
    for(const lang of ['zh','en'])Object.assign(dictionaries[lang],extraCopy[lang]);
    Object.assign(dictionaries.zh,{intro:'选择 agent 使用的工具，设置接管提示与停止方式。',extraStop:'其他停止方式',corner:'用鼠标停止操作',cornerHint:'将鼠标移到桌面最左上角，停留约半秒，工具就会停止点击和输入。移开鼠标后可继续；Esc 始终可用。'});
    Object.assign(dictionaries.en,{extraStop:'Other ways to stop',corner:'Stop using the mouse',cornerHint:'Move the pointer to the top-left corner of the desktop and leave it there for about half a second to stop clicks and typing. Move it away to continue. Esc is always available.'});
/* removed star note zh */
/* removed star note en */
    Object.assign(dictionaries.zh,{extraStop:'自定义停止方式',stopHint:'停止后保持暂停，准备好再恢复。普通鼠标移动不会停止接管。',shortcutHint:'点击“录制快捷键”，再按下想用的按键或组合键，例如 F8 或 Ctrl + Alt + K。保存后生效，Esc 始终保留。',record:'录制快捷键',rerecord:'重新录制',cancelRecord:'取消录制',clearShortcut:'清除',noShortcut:'尚未设置',listening:'请按下快捷键…（Esc 取消）',unsupportedKey:'请使用字母、数字、功能键或常用按键，可搭配 Ctrl、Alt、Shift、Win。',recordCancelled:'已取消录制',recordTimedOut:'录制已超时，请点击按钮重试。'});
    Object.assign(dictionaries.en,{extraStop:'Custom stop shortcut',stopHint:'Control stays paused until you resume. Ordinary mouse movement does not stop it.',shortcutHint:'Click Record shortcut, then press a key or combination, such as F8 or Ctrl + Alt + K. Save to apply. Esc always remains available.',record:'Record shortcut',rerecord:'Record again',cancelRecord:'Cancel recording',clearShortcut:'Clear',noShortcut:'Not set',listening:'Press your shortcut… (Esc to cancel)',unsupportedKey:'Use a letter, number, function key or common key, optionally with Ctrl, Alt, Shift or Win.',recordCancelled:'Recording cancelled',recordTimedOut:'Recording timed out. Click the button to try again.'});
    Object.assign(dictionaries.zh,{clearShortcut:'恢复默认（Esc）',noShortcut:'Esc（默认）',shortcutHint:'点击“录制快捷键”，再按下想用的按键或组合键，例如 F8 或 Ctrl + Alt + K。保存后生效；恢复默认后仅保留 Esc。'});
    Object.assign(dictionaries.en,{clearShortcut:'Restore default (Esc)',noShortcut:'Esc (default)',shortcutHint:'Click Record shortcut, then press a key or combination, such as F8 or Ctrl + Alt + K. Save to apply. Restoring the default keeps only Esc.'});
    Object.assign(dictionaries.zh,{indicatorIntro:'DSH 操作桌面时，用屏幕边缘、提示条和鼠标标签提醒你。',stopIntro:'随时中断当前这一轮桌面操作。'});
    Object.assign(dictionaries.en,{indicatorIntro:'Screen edges, a status pill and a pointer tag show when DSH is using the desktop.',stopIntro:'Interrupt the current operation series at any time.'});
    Object.assign(dictionaries.zh,{cursorIndicator:'突出显示鼠标',cursorIndicatorHint:'接管时在鼠标下方显示柔和光斑和 DSH 标签，便于看清操作位置。停止或接管结束后自动消失。'});
    Object.assign(dictionaries.en,{cursorIndicator:'Highlight the pointer',cursorIndicatorHint:'Show a soft glow and a DSH tag at the pointer during control. They disappear when control stops or ends.'});
    Object.assign(dictionaries.zh,{toolsTitle:'工具加载',toolsHint:'默认加载全部工具。需要调整时，展开下方设置，选择 agent 可以使用的工具。',customTools:'自定义工具',toolsSelected:'已启用',toolsUnit:'个工具',allTools:'恢复默认（全部启用）',noTools:'全部关闭',toolAfter:'保存后，会在当前动作结束时更新可用工具。',toolGroup_observe:'屏幕与内容',toolGroup_input:'鼠标与键盘',toolGroup_windows:'窗口与控件',toolGroup_other:'等待与工具管理'});
    Object.assign(dictionaries.en,{toolsTitle:'Tool loading',toolsHint:'All tools are loaded by default. Expand the options below to choose which tools the agent can use.',customTools:'Customize tools',toolsSelected:'Enabled',toolsUnit:'tools',allTools:'Restore defaults (enable all)',noTools:'Disable all',toolAfter:'Saved tool changes take effect after the current action finishes.',toolGroup_observe:'Screen and content',toolGroup_input:'Mouse and keyboard',toolGroup_windows:'Windows and controls',toolGroup_other:'Waiting and tool management'});
    for(const entries of toolGroups.map(group=>group[1]))for(const [name,zh,en,zhHint,enHint]of entries){dictionaries.zh['tool_'+name]=zh;dictionaries.en['tool_'+name]=en;dictionaries.zh['toolHint_'+name]=zhHint;dictionaries.en['toolHint_'+name]=enHint;}
    Object.assign(dictionaries.zh,{toolsHint:'先选择整体加载方案，需要逐项调整时选择“自定义”。',full:'全部',fullSummary:'加载全部桌面工具，默认推荐',lite:'精简',liteSummary:'只加载常用工具，减少上下文占用',custom:'自定义',customSummary:'自己选择需要加载的工具',customTools:'自定义工具清单',allTools:'全选',customMemory:'切换方案会保留自定义清单。更改后点击保存。',lazy:'懒启动',lazySummary:'启动只加载管理入口，桌面工具按需加载',lazyCount:'启动 1 项 · 允许全部 24 项',lazyHint:'开始桌面任务时，agent 先加载所需工具，会多一次工具调用。已加载工具仍占用上下文。'});
    Object.assign(dictionaries.en,{toolsHint:'Choose a loading preset. Select Custom to choose individual tools.',full:'All',fullSummary:'Load every desktop tool; the default',lite:'Lite',liteSummary:'Common tools with less context',custom:'Custom',customSummary:'Choose exactly which tools to load',customTools:'Custom tool selection',allTools:'Select all',customMemory:'Switching presets keeps your custom selection. Save to apply.',lazy:'Lazy',lazySummary:'Start with management only; load desktop tools on demand',lazyCount:'1 at startup · all 24 allowed',lazyHint:'The agent loads tools before a desktop task, adding a tool call. Loaded tools still use context.'});
    Object.assign(dictionaries.zh,{remoteVisible:'远程与录屏可见',remoteVisibleHint:'让 UU 远程、屏幕共享和录屏看到接管提示与鼠标标识。默认开启，也适用于虚拟屏幕。'});
    Object.assign(dictionaries.en,{remoteVisible:'Visible in remote sessions and recordings',remoteVisibleHint:'Show the takeover indicator and pointer marker in remote access, screen sharing and recordings. On by default, including virtual displays.'});
    function shortcutFromEvent(event) {
      const code=event.code||'',special={Space:'Space',Enter:'Enter',NumpadEnter:'Enter',Tab:'Tab',Backspace:'Backspace',Delete:'Delete',Insert:'Insert',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Pause:'Pause',CapsLock:'CapsLock',NumLock:'NumLock',ScrollLock:'ScrollLock'};
      let key=/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)?code:special[code];
      if(!key&&event.keyCode>=65&&event.keyCode<=90)key=String.fromCharCode(event.keyCode);
      if(!key&&event.keyCode>=48&&event.keyCode<=57)key=String.fromCharCode(event.keyCode);
      if(!key&&event.keyCode>=112&&event.keyCode<=135)key='F'+(event.keyCode-111);
      return key?[event.ctrlKey&&'Ctrl',event.altKey&&'Alt',event.shiftKey&&'Shift',event.metaKey&&'Win',key].filter(Boolean).join('+'):null;
    }
    const css=`
      [data-dcu-settings]{--dcu-card:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2,Canvas));--dcu-card-stroke:var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4,rgba(128,128,128,.34)));--dcu-sunken:var(--dsw-alias-bg-module-platform,color-mix(in srgb,CanvasText 4%,Canvas));--dcu-control:var(--dsw-alias-bg-layer-1,Canvas);--dcu-fg:var(--dsw-alias-label-primary,CanvasText);--dcu-muted:var(--dsw-alias-label-secondary,#61666b);--dcu-subtle:var(--dsw-alias-label-tertiary,#81858c);--dcu-line:var(--dsw-alias-border-l2,rgba(128,128,128,.2));--dcu-line-strong:var(--dsw-alias-border-l3,rgba(128,128,128,.3));--dcu-hover:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));--dcu-accent:var(--dsw-alias-state-business-primary,#4176e6);--dcu-primary:var(--dsw-alias-button-primary-fill,#0f1115);--dcu-primary-fg:var(--dsw-alias-label-primary-foreground,#fff);--dcu-selected:var(--dsw-static-neutral-bluish-400,#adb2b8);--dcu-tip-bg:var(--dsw-alias-tooltip-bg,#2b2f36);--dcu-tip-fg:#fff;color:var(--dcu-fg);font:14px/1.55 var(--dsw-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif);max-width:720px;list-style:none;box-sizing:border-box;margin:0;padding:0 0 8px}
      [data-dcu-settings] *{box-sizing:border-box}
      [data-dcu-settings] h2{font-size:18px;line-height:1.4;font-weight:600;margin:0}
      [data-dcu-settings] h3{font-size:15px;line-height:22px;font-weight:600;margin:0}
      [data-dcu-settings] p{margin:4px 0 0;color:var(--dcu-muted);font-size:13px;line-height:1.55}
      [data-dcu-settings] .dcu-header{padding:0 0 12px}
      [data-dcu-settings] .dcu-header>p{color:var(--dcu-subtle)}
      [data-dcu-settings] [data-dcu-tool-count]{flex:none;font-size:12px;line-height:20px;color:var(--dcu-muted);padding:2px 10px;border-radius:999px;background:var(--dcu-sunken)}
      [data-dcu-settings] input[type=radio],[data-dcu-settings] input[type=checkbox]{accent-color:var(--dcu-accent);width:16px;height:16px;flex:none;margin:2px 0 0}
      [data-dcu-settings] summary{cursor:pointer;color:var(--dcu-fg);font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:7px;padding:11px 0;width:fit-content}
      [data-dcu-settings] summary::-webkit-details-marker{display:none}
      [data-dcu-settings] summary:before{content:'';width:0;height:0;border-style:solid;border-width:4.5px 0 4.5px 6px;border-color:transparent transparent transparent currentColor;opacity:.55;transition:transform .15s}
      [data-dcu-settings] details[open]>summary:before{transform:rotate(90deg)}
      [data-dcu-settings] .dcu-tool-detail[hidden]{display:none}
      [data-dcu-settings] .dcu-tool-body{padding:0 0 10px}
      [data-dcu-settings] .dcu-tool-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
      [data-dcu-settings] .dcu-tool-group{border:0;border-top:.5px solid var(--dcu-line);padding:10px 0 2px;margin:8px 0 0;min-width:0}
      [data-dcu-settings] .dcu-tool-group legend{float:left;width:100%;padding:0;margin:0 0 6px}
      [data-dcu-settings] .dcu-tool-group-label{display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600;cursor:pointer}
      [data-dcu-settings] .dcu-tool-group-label input{margin:0}
      [data-dcu-settings] .dcu-tool-group-label .dcu-tool-count{margin-left:auto;font-weight:400}
      [data-dcu-settings] .dcu-tool-grid{clear:both;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px}
      [data-dcu-settings] .dcu-tool-item{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:var(--dsw-radius-sm,8px);cursor:pointer;min-width:0}
      [data-dcu-settings] .dcu-tool-item:hover{background:var(--dcu-hover)}
      [data-dcu-settings] .dcu-tool-item strong{display:block;font-size:13px;font-weight:500;line-height:20px}
      [data-dcu-settings] .dcu-tool-item small{display:block;font-size:12px;color:var(--dcu-subtle);line-height:1.45}
      [data-dcu-settings] .dcu-tool-count{font-size:12px;color:var(--dcu-subtle);white-space:nowrap}
      [data-dcu-settings] .dcu-segment{display:inline-flex;width:fit-content;gap:2px;padding:2px;border-radius:10px;background:var(--dcu-control);border:.5px solid var(--dcu-line-strong)}
      [data-dcu-settings] .dcu-segment label{position:relative;display:inline-flex;align-items:center;padding:4px 14px;border-radius:8px;font-size:13px;color:var(--dcu-muted);cursor:pointer;transition:background .15s,color .15s}
      [data-dcu-settings] .dcu-segment label:has(input:checked){background:color-mix(in srgb,var(--dcu-fg) 10%,var(--dcu-control));color:var(--dcu-fg)}
      [data-dcu-settings] .dcu-segment label:has(input:focus-visible){outline:2px solid var(--dcu-accent);outline-offset:1px}
      [data-dcu-settings] .dcu-segment label:has(input:disabled){opacity:.45;cursor:not-allowed}
      [data-dcu-settings] .dcu-segment input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
      [data-dcu-settings] .dcu-control{font:inherit;font-size:13px;color:var(--dcu-fg);background:var(--dcu-control);border:.5px solid var(--dcu-line-strong);border-radius:var(--dsw-radius-sm,8px);padding:7px 10px;min-height:34px;max-width:100%;width:100%}
      [data-dcu-settings] .dcu-number{display:flex;gap:8px;align-items:center;color:var(--dcu-subtle);font-size:12px}
      [data-dcu-settings] .dcu-number input{width:100px}
      [data-dcu-settings] .dcu-key{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:26px;padding:0 8px;font:600 12px/1 'Segoe UI',sans-serif;color:var(--dcu-fg);border:.5px solid var(--dcu-line-strong);border-bottom-width:2px;border-radius:6px;background:var(--dcu-control)}
      [data-dcu-settings] .dcu-shortcut-value[data-recording=true]{border-color:var(--dcu-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dcu-accent) 22%,transparent)}
      [data-dcu-settings] button{font:inherit;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border:.5px solid var(--dcu-line-strong);border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dcu-fg);cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s}
      [data-dcu-settings] button:hover:enabled{background:var(--dcu-hover)}
      [data-dcu-settings] button.dcu-primary{background:var(--dcu-primary);border-color:transparent;color:var(--dcu-primary-fg)}
      [data-dcu-settings] button.dcu-primary:hover:enabled{background:var(--dcu-primary);opacity:.86}
      [data-dcu-settings] button.dcu-small{height:28px;padding:0 10px;font-size:12px;border-radius:var(--dsw-radius-sm,8px)}
      [data-dcu-settings] button:disabled,[data-dcu-settings] input:disabled,[data-dcu-settings] fieldset:disabled{opacity:.4;cursor:not-allowed}
      [data-dcu-settings] .dcu-control:focus-visible,[data-dcu-settings] button:focus-visible,[data-dcu-settings] input:focus-visible,[data-dcu-settings] summary:focus-visible{outline:2px solid var(--dcu-accent);outline-offset:2px}
      [data-dcu-settings] .dcu-footer{position:sticky;bottom:12px;z-index:1;display:flex;gap:12px;justify-content:space-between;align-items:center;margin-top:4px;padding:10px 10px 10px 16px;border:.5px solid var(--dcu-card-stroke);border-radius:var(--dsw-radius-lg,16px);background:var(--dcu-card);box-shadow:0 8px 24px rgba(0,0,0,.12)}
      [data-dcu-settings] .dcu-actions{display:flex;gap:8px}
      [data-dcu-settings] .dcu-status{font-size:12px;color:var(--dcu-subtle)}
      [data-dcu-settings] [data-tone=error]{color:var(--dsw-alias-state-error-primary,#d93f3f)}
      [data-dcu-settings] [data-tone=success]{color:var(--dsw-alias-state-success-primary,#2f9e5b)}
      [data-dcu-settings] .dcu-section{border:.5px solid var(--dcu-card-stroke);border-radius:var(--dsw-radius-xl,20px);background:var(--dcu-card);padding:8px 14px 12px;margin-bottom:10px}
      [data-dcu-settings] .dcu-section-head{display:flex;align-items:center;gap:4px;min-height:34px;margin-bottom:6px}
      [data-dcu-settings] .dcu-end{margin-left:auto}
      [data-dcu-settings] .dcu-section-head>.dcu-end{display:flex;align-items:center;gap:8px}
      [data-dcu-settings] .dcu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 16px}
      [data-dcu-settings] .dcu-item{display:flex;align-items:center;gap:12px;min-width:0}
      [data-dcu-settings] .dcu-item-main{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
      [data-dcu-settings] .dcu-item-title{display:block;font-size:14px;line-height:22px;color:var(--dcu-fg)}
      [data-dcu-settings] label.dcu-item-title{cursor:pointer}
      [data-dcu-settings] .dcu-nowrap{white-space:nowrap}
      [data-dcu-settings] .dcu-item-title .dcu-info{vertical-align:top;margin-left:2px}
      [data-dcu-settings] .dcu-caption{font-size:12px;line-height:18px;color:var(--dcu-subtle)}
      [data-dcu-settings] .dcu-hint{margin:6px 0 10px;font-size:12px;color:var(--dcu-subtle)}
      [data-dcu-settings] .dcu-item-main .dcu-hint{margin:0}
      [data-dcu-settings] .dcu-art{flex:none;display:flex;align-items:center;justify-content:center;width:96px;height:60px;border-radius:var(--dsw-radius-md,12px);background:var(--dcu-sunken);border:.5px solid var(--dcu-line);overflow:hidden;transition:border-color .15s,opacity .15s;--dcu-desk:color-mix(in srgb,var(--dcu-accent) 13%,var(--dcu-control));--dcu-bar:color-mix(in srgb,var(--dcu-fg) 7%,var(--dcu-control));--dcu-ink:color-mix(in srgb,var(--dcu-fg) 16%,transparent);--dcu-ink-strong:color-mix(in srgb,var(--dcu-fg) 34%,transparent)}
      [data-dcu-settings] .dcu-art>svg{display:block;width:100%;height:100%}
      [data-dcu-settings] label.dcu-art{cursor:pointer}
      [data-dcu-settings] label.dcu-art:hover{border-color:var(--dcu-line-strong)}
      [data-dcu-settings] .dcu-item:has(input:disabled) .dcu-art{cursor:not-allowed;opacity:.55}
      [data-dcu-settings] .dcu-art .a-win{fill:var(--dcu-control)}
      [data-dcu-settings] .dcu-art .a-frame{fill:none;stroke:var(--dcu-line-strong);stroke-width:.75}
      [data-dcu-settings] .dcu-art .a-desk{fill:var(--dcu-desk);stroke:var(--dcu-line-strong);stroke-width:.75}
      [data-dcu-settings] .dcu-art .a-bar{fill:var(--dcu-bar)}
      [data-dcu-settings] .dcu-art .a-sep{fill:none;stroke:var(--dcu-line-strong);stroke-width:.5}
      [data-dcu-settings] .dcu-art .a-ink{fill:var(--dcu-ink)}
      [data-dcu-settings] .dcu-art .a-ink2{fill:var(--dcu-ink-strong)}
      [data-dcu-settings] .dcu-art .a-acc{fill:var(--dcu-accent)}
      [data-dcu-settings] .dcu-art .a-edge{stroke:var(--dcu-accent);stroke-width:1.2}
      [data-dcu-settings] .dcu-art .a-caret{fill:none;stroke:var(--dcu-accent);stroke-width:1}
      [data-dcu-settings] .dcu-art .a-glow{fill:none;stroke:var(--dcu-accent);stroke-width:1.3}
      [data-dcu-settings] .dcu-art .a-soft{stroke-width:4;stroke-opacity:.22}
      [data-dcu-settings] .dcu-art .a-pill{fill:#23262d;stroke:rgba(255,255,255,.24);stroke-width:.6}
      [data-dcu-settings] .dcu-art .a-dot{fill:#7aaaff}
      [data-dcu-settings] .dcu-art .a-text{fill:#fff;fill-opacity:.85}
      [data-dcu-settings] .dcu-art .a-key{fill:none;stroke:#fff;stroke-opacity:.55;stroke-width:.7}
      [data-dcu-settings] .dcu-art .a-ptr{fill:#fff;stroke:#1d2025;stroke-width:1;stroke-linejoin:round}
      [data-dcu-settings] .dcu-art .a-dsh{fill:var(--dcu-accent);stroke:#fff;stroke-width:1;stroke-linejoin:round;filter:drop-shadow(0 0 1.6px var(--dcu-accent))}
      [data-dcu-settings] .dcu-art .a-ghost{fill:none;stroke:var(--dcu-ink-strong);stroke-width:.9;stroke-dasharray:3 2}
      [data-dcu-settings] .dcu-art .a-open{fill:none;stroke:var(--dcu-accent);stroke-width:.9;stroke-dasharray:2 1.6}
      [data-dcu-settings] .dcu-art .a-eye{fill:none;stroke:var(--dcu-ink-strong);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
      [data-dcu-settings] .dcu-art .a-spot0{stop-color:var(--dcu-accent);stop-opacity:.42}
      [data-dcu-settings] .dcu-art .a-spot1{stop-color:var(--dcu-accent);stop-opacity:0}
      [data-dcu-settings] .dcu-art .a-tag{fill:#fff;font:700 7px/1 'Segoe UI',sans-serif}
      [data-dcu-settings] .dcu-art .a-cap{fill:var(--dcu-fg);font:600 12px/1 'Segoe UI',sans-serif}
      [data-dcu-settings] .dcu-item:has(.dcu-presets)>.dcu-item-main{flex:1}
      [data-dcu-settings] .dcu-segment.dcu-presets{display:flex;width:auto;align-self:stretch}
      [data-dcu-settings] .dcu-presets>label{flex:1;justify-content:center}
      [data-dcu-settings] .dcu-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px 16px;padding:0 0 6px}
      [data-dcu-settings] .dcu-field{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:36px;font-size:13px;color:var(--dcu-muted)}
      [data-dcu-settings] .dcu-field>.dcu-item-title{font-size:13px;line-height:22px;color:var(--dcu-muted)}
      [data-dcu-settings] .dcu-info{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:50%;color:var(--dcu-subtle);cursor:help;outline:none}
      [data-dcu-settings] .dcu-info>svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round}
      [data-dcu-settings] .dcu-info:hover,[data-dcu-settings] .dcu-info[data-open],[data-dcu-settings] .dcu-info:focus-visible{color:var(--dcu-fg);background:var(--dcu-hover)}
      [data-dcu-settings] .dcu-info:focus-visible{box-shadow:0 0 0 2px var(--dcu-accent)}
      [data-dcu-settings] .dcu-tip{display:none;position:fixed;inset:auto;margin:0;z-index:2147483000;width:max-content;max-width:min(300px,calc(100vw - 16px));padding:8px 11px;overflow:visible;border-radius:var(--dsw-radius-sm,8px);background:var(--dcu-tip-bg);color:var(--dcu-tip-fg);border:.5px solid rgba(255,255,255,.1);font-size:12px;font-weight:400;line-height:1.6;text-align:left;white-space:normal;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:default}
      [data-dcu-settings] .dcu-tip[data-open]{display:block;animation:dcu-tip-in .12s ease-out}
      [data-dcu-settings] .dcu-tip:after{content:'';position:absolute;width:7px;height:7px;background:inherit;border:inherit;transform:rotate(45deg)}
      [data-dcu-settings] .dcu-tip[data-side=top]:after{left:calc(var(--dcu-caret,50%) - 4px);bottom:-4px;border-top:0;border-left:0}
      [data-dcu-settings] .dcu-tip[data-side=bottom]:after{left:calc(var(--dcu-caret,50%) - 4px);top:-4px;border-bottom:0;border-right:0}
      [data-dcu-settings] .dcu-tip[data-side=left]:after{right:-4px;top:calc(50% - 4px);border-bottom:0;border-left:0}
      @keyframes dcu-tip-in{from{opacity:0}}
      [data-dcu-settings] input[role=switch]{appearance:none;flex:none;width:36px;height:20px;margin:0;border-radius:999px;background:var(--dsw-alias-border-l4,rgba(128,128,128,.38));position:relative;cursor:pointer;transition:background .15s}
      [data-dcu-settings] input[role=switch]:after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s}
      [data-dcu-settings] input[role=switch]:checked{background:var(--dcu-accent)}
      [data-dcu-settings] input[role=switch]:checked:after{transform:translateX(16px)}
      [data-dcu-settings] .dcu-field .dcu-text{width:min(190px,100%)}
      [data-dcu-settings] .dcu-detail>summary{padding:10px 0 8px}
      [data-dcu-settings] .dcu-tool-detail{margin:12px 0 0;border:.5px solid var(--dcu-line-strong);border-radius:var(--dsw-radius-md,12px);padding:0 14px}
      [data-dcu-settings] .dcu-shortcut-value{flex-wrap:wrap;align-content:center;gap:2px;padding:4px;font-size:12px;line-height:1.4;color:var(--dcu-muted);text-align:center}
      [data-dcu-settings] .dcu-shortcut-value .dcu-key{min-width:22px;height:20px;padding:0 5px;font-size:10.5px}
      [data-dcu-settings] .dcu-shortcut-value small{font-size:11px;color:var(--dcu-subtle)}
      [data-dcu-settings] .dcu-plus{font-size:9px;color:var(--dcu-subtle)}
      [data-dcu-settings] .dcu-shortcut-value:is([data-keys='3'],[data-keys='4']) .dcu-key{min-width:18px;padding:0 3px;font-size:9.5px}
      [data-dcu-settings] .dcu-shortcut-value[data-recording=true] small{flex-basis:100%}
      [data-dcu-settings] select.dcu-control{width:auto;min-width:132px;min-height:30px;padding:4px 8px;cursor:pointer}
      @media(max-width:640px){[data-dcu-settings] .dcu-tool-grid{grid-template-columns:1fr}[data-dcu-settings] .dcu-section{padding:8px 14px 12px}[data-dcu-settings] .dcu-footer{flex-wrap:wrap}}
    `;
    Object.assign(dictionaries.zh,{pluginDescription:'让 AI 操作 Windows 桌面，支持控制提示、停止快捷键和工具选择。',openSettings:'点击进行具体设置 →',notLoaded:'未能读取电脑操控设置。宿主尚未提供此配置，请刷新页面或重新启动 DSH 后重试。',loadingSettings:'正在读取电脑操控设置…',reloadSettings:'刷新页面',delayHint:'整轮操作结束后再隐藏提示。范围 200–3000 毫秒。'});
    Object.assign(dictionaries.en,{pluginDescription:'Let the agent use Windows apps, with control indicators, stop shortcuts and tool selection.',openSettings:'Click to configure →',notLoaded:'Computer Use settings could not be read. The host has not exposed this configuration. Refresh or restart DSH.',loadingSettings:'Loading Computer Use settings…',reloadSettings:'Refresh page',delayHint:'Hide the indicator after the complete operation series ends. Range: 200–3000 ms.'});
    Object.assign(dictionaries.zh,{stop:'停止操作',stopHint:'Esc 只停止当前这一轮操作。下次发起任务或说“继续”即可再次使用，无需到设置恢复。普通鼠标移动和其他按键不会停止。',previewed:'已请求预览',indicatorHint:'操作和短暂思考期间持续显示；最后一次桌面操作完成后，空闲 30 秒自动收起。'});
    Object.assign(dictionaries.en,{stop:'Stop control',stopHint:'Esc stops this operation series. A new task or a request to continue can use the desktop automatically, with no settings change. Ordinary pointer movement and other keys do not stop control.',previewed:'Preview requested',indicatorHint:'Stay visible through actions and short reasoning gaps; hide after 30 seconds without another desktop action.'});
    // Chinese first: a feature's English name appears once, in brackets, where
    // the page first names it. Each hint sits behind an info icon.
    Object.assign(dictionaries.zh,{title:'电脑操控（Computer Use）',intro:'让 DSH 操作 Windows 桌面程序。',moreInfo:'说明',pluginDescription:'让 AI 操作 Windows 桌面程序和网页，可设置接管提示、停止快捷键和工具。',
      toolsTitle:'工具',toolsInfo:'全部：启动时加载 25 个工具。精简：只加载 11 个常用工具，减少上下文占用。懒启动：启动时只加载管理入口，开始桌面任务时再加载，会多一次工具调用。自定义：自己挑选，切换方案时保留清单。保存后在当前动作结束时生效。',
      indicatorTitle:'接管提示',indicatorInfo:'DSH 用鼠标和键盘操作桌面时，用屏幕边缘、提示条和鼠标标签提醒你。读取界面和在后台完成的控件操作不显示这些提示。',
      indicator:'屏幕边缘与提示条',appearance:'更多选项',preview:'预览',delay:'操作后保留提示',
      escTitle:'按 Esc 停止',stopHint:'Esc 只停止当前这一轮操作；下次发起任务或说“继续”即可再次使用，无需到设置恢复。普通鼠标移动和其他按键不会停止。'});
    Object.assign(dictionaries.en,{title:'Computer Use',intro:'Let DSH operate Windows desktop apps.',moreInfo:'Details',pluginDescription:'Let the agent use Windows apps and web pages, with control indicators, stop shortcuts and tool selection.',
      toolsTitle:'Tools',toolsInfo:'All: load 25 tools at startup. Lite: 11 common tools, less context. Lazy: only the management entry at startup; tools load at the first desktop task, adding one tool call. Custom: your own selection, kept when you switch presets. Saved changes apply after the current action.',
      indicatorTitle:'Takeover indicator',indicatorInfo:'Screen edges, a banner and a pointer tag show when DSH uses your mouse and keyboard. Reading the screen and control actions done in the background show none of them.',
      indicator:'Screen edges and banner',appearance:'More options',preview:'Preview',delay:'Keep visible after an action',
      escTitle:'Press Esc to stop',stopHint:'Esc stops this operation series. A new task or a request to continue resumes automatically, with no settings change. Ordinary pointer movement and other keys do not stop control.'});
    Object.assign(dictionaries.zh,{escAlways:'始终可用',listening:'请按下快捷键…',listeningCancel:'按 Esc 取消'});
    Object.assign(dictionaries.en,{escAlways:'Always on',listening:'Press your shortcut…',listeningCancel:'Esc to cancel'});
    // A hint opens on hover, focus or click, above its icon: a pointer hangs
    // down and to the right of its tip, so even a large pointer leaves the text
    // readable. The pointer can rest on the hint, and a click keeps it open.
    // It shows in the top layer, where no scroller or dialog clips it.
    function Info({id,label,text}){
      const anchor=React.useRef(null),tip=React.useRef(null),timer=React.useRef(0);
      const [open,setOpen]=React.useState(false),[pinned,setPinned]=React.useState(false);
      const show=(next,delay)=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{setOpen(next);if(!next)setPinned(false);},delay);};
      const toggle=()=>{if(pinned)show(false,0);else{clearTimeout(timer.current);setOpen(true);setPinned(true);}};
      React.useEffect(()=>()=>clearTimeout(timer.current),[]);
      React.useLayoutEffect(()=>{
        const icon=anchor.current,el=tip.current;
        if(!open||!icon||!el)return;
        try{el.showPopover();}catch{}
        const r=icon.getBoundingClientRect(),width=el.offsetWidth,height=el.offsetHeight,view=document.documentElement,gap=8,edge=8;
        let side='top',left=r.left+r.width/2-width/2,top=r.top-gap-height;
        if(top<edge){if(r.left-gap-width>=edge){side='left';left=r.left-gap-width;top=r.top+r.height/2-height/2;}else{side='bottom';top=r.bottom+gap;}}
        left=Math.max(edge,Math.min(left,view.clientWidth-edge-width));top=Math.max(edge,Math.min(top,view.clientHeight-edge-height));
        Object.assign(el.style,{left:left+'px',top:top+'px'});el.dataset.side=side;el.style.setProperty('--dcu-caret',Math.round(r.left+r.width/2-left)+'px');
        const close=()=>{clearTimeout(timer.current);setOpen(false);setPinned(false);};
        const key=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
        const press=event=>{if(!icon.contains(event.target))close();};
        window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',press,true);
        return ()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',press,true);try{el.hidePopover();}catch{}};
      },[open]);
      return h('span',{className:'dcu-info',ref:anchor,tabIndex:0,role:'button','aria-label':label,'aria-describedby':id,'data-open':open||undefined,
        onPointerEnter:()=>show(true,120),onPointerLeave:()=>{if(!pinned)show(false,250);},onFocus:()=>show(true,0),onBlur:()=>{if(!pinned)show(false,0);},
        onClick:event=>{event.preventDefault();if(!tip.current?.contains(event.target))toggle();},onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}}},
        h('svg',{viewBox:'0 0 16 16','aria-hidden':true,focusable:false},h('circle',{cx:8,cy:8,r:6.4}),h('path',{d:'M8 7.3v3.9M8 4.9v.2'})),
        h('span',{className:'dcu-tip',id,role:'tooltip',ref:tip,popover:'manual','data-open':open||undefined},text));
    }
    // Each setting has a small picture of what it changes. The pictures use the
    // page's theme tokens through the a-* classes in css.
    const drawing=(...children)=>h('svg',{viewBox:'0 0 112 70','aria-hidden':true,focusable:false},...children);
    const box=(className,x,y,width,height,rx=0)=>h('rect',{className,x,y,width,height,rx});
    const arrow=(x,y)=>h('path',{className:'a-ptr',d:`M${x} ${y}v15.5l3.8-3.6 2.7 6.1 2.6-1.1-2.7-6h5.4z`});
    // DSH's own pointer inside a page: smaller, in the accent colour.
    const dshArrow=(x,y)=>h('path',{className:'a-dsh',d:`M${x} ${y}v11l2.7-2.6 1.9 4.3 1.9-.8-1.9-4.2h3.8z`});
    const monitor=()=>[box('a-desk',9,5,94,52,4),h('path',{className:'a-bar',d:'M9.4 50h93.2v3.6a3.4 3.4 0 0 1-3.4 3.4H12.8a3.4 3.4 0 0 1-3.4-3.4z'}),box('a-ink2',49,52,3,3,.8),box('a-ink',54.5,52,3,3,.8),box('a-ink',60,52,3,3,.8),h('path',{className:'a-ink',d:'M50 57h12l1.5 6h-15z'}),box('a-ink',41,63,30,2,1)];
    const banner=y=>[box('a-pill',33,y,46,9,4.5),h('circle',{className:'a-dot',cx:38.5,cy:y+4.5,r:1.8}),box('a-text',42.5,y+3.55,23,1.9,.95),box('a-key',68,y+2,8,5,1.2)];
    const arts={
      // Glowing screen edges and the status banner, at the top or the bottom.
      indicator:(on,bottom)=>drawing(...monitor(),box('a-win',22,15,48,27,2.5),h('path',{className:'a-bar',d:'M22 17.5a2.5 2.5 0 0 1 2.5-2.5h43a2.5 2.5 0 0 1 2.5 2.5v2.5H22z'}),box('a-ink',26,25,30,2.2,1.1),box('a-ink',26,30,22,2.2,1.1),box('a-frame',22,15,48,27,2.5),
        ...(on?[box('a-glow a-soft',12,8,88,46,2.5),box('a-glow',9.8,5.8,92.4,50.4,3.6),...banner(bottom?40:9.5)]:[])),
      // A soft spotlight and a DSH tag at the pointer.
      cursor:(on,id)=>drawing(h('defs',null,h('radialGradient',{id},h('stop',{offset:0,className:'a-spot0'}),h('stop',{offset:1,className:'a-spot1'}))),
        box('a-ink',14,13,42,3,1.5),box('a-ink',14,20,30,3,1.5),box('a-ink',14,27,36,3,1.5),box('a-ink',14,34,24,3,1.5),
        ...(on?[h('circle',{cx:50,cy:33,r:21,fill:`url(#${id})`})]:[]),arrow(48,25),...(on?[box('a-acc',60,44,26,11,5.5),h('text',{className:'a-tag',x:73,y:51.9,textAnchor:'middle'},'DSH')]:[])),
      // One square per tool: filled loads at startup, dashed loads on demand, faint is off.
      tools:(loaded,allowed)=>drawing(...toolGroups.flatMap(([,entries],row)=>entries.map(([name],col)=>box(loaded.has(name)?'a-acc':allowed.has(name)?'a-open':'a-ink',15.5+col*12,12.5+row*12,9,9,2.2)))),
      esc:()=>drawing(box('a-ink2',33,19,46,34,7),box('a-win',33,16,46,34,7),box('a-frame',33,16,46,34,7),h('text',{className:'a-cap',x:56,y:37.2,textAnchor:'middle'},'Esc'))
    };
    function Card({scope,t,savePatch,as='li',idPrefix='dcu',view}) {
      if(view==='summary')return h('span',{'data-dcu-summary':true},t('pluginDescription'),' ',h('span',{style:{color:'var(--dsw-alias-label-link,#71a7ff)'}},t('openSettings')));
      return h(SettingsGate,{scope,t,savePatch,as,idPrefix});
    }
    function SettingsGate(props){
      const state=React.useSyncExternalStore(fn=>props.scope.subscribe(fn),()=>props.scope.getSnapshot());
      if((state.status!==undefined&&state.status!=='ready')||!state.value)return h(props.as,{'data-dcu-unavailable':true},h('p',{role:'status'},props.t(state.status==='loading'?'loadingSettings':'notLoaded')),h('button',{type:'button',onClick:()=>window.location.reload()},props.t('reloadSettings')));
      return h(SettingsCard,props);
    }
    function SettingsCard({scope,t,savePatch,as='li',idPrefix='dcu'}) {
      const state = React.useSyncExternalStore(listener => scope.subscribe(listener), () => scope.getSnapshot());
      const available=state.status===undefined?state.value!==undefined:state.status==='ready';
      const writable=available&&state.writable;
      const saved = {...defaults,...state.value};
      if(!state.value?.toolPreset||saved.toolPreset==='auto')saved.toolPreset=saved.enabledTools.length===allToolNames.length?'full':'custom';
      const [draft,setDraft] = React.useState(saved), [dirty,setDirty] = React.useState(false);
      const [saving,setSaving] = React.useState(false), [message,setMessage] = React.useState(''),[tone,setTone]=React.useState('');
      const [recording,setRecording] = React.useState(false), [recordMessage,setRecordMessage] = React.useState('');
      const savedKey = JSON.stringify(Object.fromEntries(Object.keys(defaults).map(key=>[key,saved[key]])));
      React.useEffect(()=>{if(!dirty)setDraft(saved);},[savedKey,dirty]);
      const change = (field,value) => {const next={...draft,[field]:value};
        setDraft(next);setDirty(Object.keys(defaults).some(key=>!equal(next[key],saved[key])));setMessage('');};
      const selectTools=(names,enabled)=>{const selected=new Set(draft.enabledTools);for(const name of names)enabled?selected.add(name):selected.delete(name);change('enabledTools',allToolNames.filter(name=>selected.has(name)));};
      React.useEffect(()=>{
        if(!recording)return;
        if(!writable||saving){setRecording(false);return;}
        const cancel=()=>{setRecording(false);setRecordMessage('recordCancelled');};
        const keydown=event=>{
          if(event.isComposing)return;
          event.preventDefault();event.stopImmediatePropagation();
          if(event.key==='Escape'||event.code==='Escape'){cancel();return;}
          if(event.repeat||['Control','Alt','Shift','Meta','OS'].includes(event.key))return;
          const shortcut=shortcutFromEvent(event);
          if(!shortcut){setRecordMessage('unsupportedKey');return;}
          change('stopShortcut',shortcut);setRecordMessage('');setRecording(false);
        };
        const timer=setTimeout(()=>{setRecording(false);setRecordMessage('recordTimedOut');},15000);
        window.addEventListener('keydown',keydown,true);window.addEventListener('blur',cancel);
        return ()=>{clearTimeout(timer);window.removeEventListener('keydown',keydown,true);window.removeEventListener('blur',cancel);};
      },[recording,writable,saving,savedKey]);
      const run = async (patch,success) => {
        setSaving(true);setMessage('');
        try {await savePatch(patch);setMessage(t(success));setTone('success');return true;}
        catch(error){setMessage(t('failed')+': '+String(error.message||error));setTone('error');return false;}
        finally{setSaving(false);}
      };
      const save = async () => {
        if(!draft.indicatorText.trim()||draft.indicatorText.length>120||/[\r\n\x00-\x1f]/.test(draft.indicatorText)||!Number.isInteger(draft.indicatorIdleMs)||draft.indicatorIdleMs<200||draft.indicatorIdleMs>3000){setMessage(t('invalid'));setTone('error');return;}
        const patch=Object.fromEntries(Object.keys(defaults).filter(key=>!equal(draft[key],saved[key])).map(key=>[key,draft[key]]));
        if(await run(patch,'saved'))setDirty(false);
      };
      const disabled = saving||!writable||recording,indicatorDisabled=disabled||!draft.indicatorEnabled;
      const activeTools=draft.toolPreset==='lazy'?['tools']:draft.toolPreset==='full'?allToolNames:draft.toolPreset==='lite'?liteToolNames:draft.enabledTools;
      const customDisabled=disabled||draft.toolPreset!=='custom';
      const radio=(field,value,label)=>h('label',{key:value},h('input',{type:'radio',name:idPrefix+'-'+field,id:idPrefix+'-'+field+'-'+value,value,checked:draft[field]===value,disabled:indicatorDisabled,onChange:()=>change(field,value)}),label);
      const button=(label,props)=>h('button',{type:'button',...props},t(label));
      const info=key=>h(Info,{id:idPrefix+'-tip-'+key,label:t('moreInfo'),text:t(key)});
      const head=(id,title,hint,...end)=>h('div',{className:'dcu-section-head'},h('h3',{id},t(title)),hint&&info(hint),end.length>0&&h('div',{className:'dcu-end'},...end));
      // A setting reads as a picture of its effect, then its name and control,
      // two to a row, so no switch sits far from its name.
      const item=(art,...main)=>h('div',{className:'dcu-item'},art,h('div',{className:'dcu-item-main'},...main));
      // The hint icon stays on the line of the title's last word (or last two
      // Chinese characters), so a narrow column never leaves it alone on a line.
      const title=(text,hint,props)=>{const cut=/[\u2e80-\u9fff\uff00-\uffef]$/.test(text)?text.length-2:text.lastIndexOf(' ')+1;return h(props?.htmlFor?'label':'span',{className:'dcu-item-title',...props},text.slice(0,cut),h('span',{className:'dcu-nowrap'},text.slice(cut),hint&&info(hint)));};
      const picture=art=>h('div',{className:'dcu-art','aria-hidden':true},art);
      const toggle=(field,label,locked)=>h('input',{id:idPrefix+'-'+field,type:'checkbox',role:'switch','aria-label':t(label),checked:draft[field],disabled:disabled||locked,onChange:e=>change(field,e.target.checked)});
      const switchItem=(field,label,hint,art,locked)=>item(h('label',{className:'dcu-art',htmlFor:idPrefix+'-'+field,'aria-hidden':true},art),title(t(label),hint,{htmlFor:idPrefix+'-'+field}),toggle(field,label,locked));
      const field=(label,control)=>h('div',{className:'dcu-field'},label,control);
      const allowedTools=['full','lazy'].includes(draft.toolPreset)?allToolNames:activeTools;
      const keycap=(key,label)=>h('kbd',{className:'dcu-key',key},label);
      const shortcutKeys=recording?[h('span',{key:'listen'},t('listening')),h('small',{key:'cancel'},t('listeningCancel'))]
        :draft.stopShortcut?draft.stopShortcut.split('+').flatMap((key,i)=>i?[h('span',{className:'dcu-plus',key:'+'+i},' + '),keycap(i,key)]:[keycap(i,key)])
        :[keycap('esc','Esc'),h('small',{key:'default'},t('noShortcut').slice(3))];
      return h(as,{'data-dcu-settings':'true'},h('style',null,css),
        h('header',{className:'dcu-header'},
          h('h2',null,t('title')),h('p',null,t('intro'))),
        h('section',{className:'dcu-section','aria-labelledby':idPrefix+'-tools-title'},
          head(idPrefix+'-tools-title','toolsTitle','toolsInfo',h('span',{className:'dcu-tool-count','data-dcu-tool-count':true},draft.toolPreset==='lazy'?t('lazyCount'):t('toolsSelected')+' '+activeTools.length+' / '+allToolNames.length)),
          item(picture(arts.tools(new Set(activeTools),new Set(allowedTools))),
            h('div',{className:'dcu-segment dcu-presets',role:'radiogroup','aria-label':t('toolsTitle')},...['full','lite','lazy','custom'].map(preset=>h('label',{key:preset},h('input',{type:'radio',name:idPrefix+'-toolPreset',id:idPrefix+'-toolPreset-'+preset,value:preset,checked:draft.toolPreset===preset,disabled,onChange:()=>change('toolPreset',preset)}),t(preset)))),
            h('p',{className:'dcu-hint','data-dcu-preset-hint':true},t(draft.toolPreset+'Summary'))),
          h('details',{className:'dcu-tool-detail','data-dcu-tools':true,hidden:draft.toolPreset!=='custom',open:draft.toolPreset==='custom'},h('summary',null,t('customTools')),
            h('div',{className:'dcu-tool-body'},h('div',{className:'dcu-tool-toolbar'},button('allTools',{className:'dcu-small',disabled:customDisabled||draft.enabledTools.length===allToolNames.length,onClick:()=>change('enabledTools',[...allToolNames])}),button('noTools',{className:'dcu-small',disabled:customDisabled||!draft.enabledTools.length,onClick:()=>change('enabledTools',[])})),
              ...toolGroups.map(([group,entries])=>{const names=entries.map(entry=>entry[0]),count=names.filter(name=>draft.enabledTools.includes(name)).length;return h('fieldset',{className:'dcu-tool-group',disabled:customDisabled,key:group},
                h('legend',null,h('label',{className:'dcu-tool-group-label'},h('input',{type:'checkbox',id:idPrefix+'-tool-group-'+group,checked:count===names.length,'aria-checked':count&&count<names.length?'mixed':count===names.length,ref:input=>{if(input)input.indeterminate=count>0&&count<names.length;},onChange:e=>selectTools(names,e.target.checked)}),t('toolGroup_'+group),h('span',{className:'dcu-tool-count'},count+' / '+names.length))),
                h('div',{className:'dcu-tool-grid'},...entries.map(([name])=>h('label',{className:'dcu-tool-item',key:name,title:'windows_computer_use_'+name},h('input',{type:'checkbox',id:idPrefix+'-tool-'+name,'data-dcu-tool':name,checked:draft.enabledTools.includes(name),disabled:customDisabled,onChange:e=>selectTools([name],e.target.checked)}),h('span',null,h('strong',null,t('tool_'+name)),h('small',null,t('toolHint_'+name)))))));})))),
        h('section',{className:'dcu-section','aria-labelledby':idPrefix+'-indicator-title'},
          head(idPrefix+'-indicator-title','indicatorTitle','indicatorInfo',button('preview',{className:'dcu-small',disabled:disabled||dirty||(!draft.indicatorEnabled&&!draft.cursorIndicatorEnabled),onClick:()=>run({previewToken:Date.now()},'previewed'),title:dirty?t('previewHint'):undefined})),
          h('div',{className:'dcu-grid'},
            switchItem('indicatorEnabled','indicator','indicatorHint',arts.indicator(draft.indicatorEnabled,draft.indicatorPosition==='bottom')),
            switchItem('cursorIndicatorEnabled','cursorIndicator','cursorIndicatorHint',arts.cursor(draft.cursorIndicatorEnabled,idPrefix+'-spot'))),
          h('details',{className:'dcu-detail'},h('summary',null,t('appearance')),
            h('div',{className:'dcu-fields'},
              field(title(t('position'),null,{id:idPrefix+'-position-label'}),h('div',{className:'dcu-segment',role:'radiogroup','aria-labelledby':idPrefix+'-position-label'},radio('indicatorPosition','top',t('top')),radio('indicatorPosition','bottom',t('bottom')))),
              field(title(t('delay'),'delayHint',{htmlFor:idPrefix+'-delay'}),h('div',{className:'dcu-number'},h('input',{className:'dcu-control',id:idPrefix+'-delay',type:'number',min:200,max:3000,step:100,value:draft.indicatorIdleMs,disabled:indicatorDisabled,onChange:e=>change('indicatorIdleMs',Number(e.target.value))}),h('span',null,t('ms')))),
              field(title(t('text'),null,{htmlFor:idPrefix+'-text'}),h('input',{className:'dcu-control dcu-text',id:idPrefix+'-text',type:'text',maxLength:120,value:draft.indicatorText,disabled:indicatorDisabled,onChange:e=>change('indicatorText',e.target.value)})),
              field(title(t('remoteVisible'),'remoteVisibleHint',{htmlFor:idPrefix+'-remoteIndicatorVisible'}),toggle('remoteIndicatorVisible','remoteVisible'))))),
        h('section',{className:'dcu-section','aria-labelledby':idPrefix+'-stop-title'},
          head(idPrefix+'-stop-title','stop',null,button('clearShortcut',{className:'dcu-small',disabled:disabled||!draft.stopShortcut,onClick:()=>{change('stopShortcut','');setRecordMessage('');}})),
          h('div',{className:'dcu-grid'},
            item(picture(arts.esc()),title(t('escTitle'),'stopHint'),h('span',{className:'dcu-caption'},t('escAlways'))),
            h('div',{className:'dcu-item','data-dcu-shortcut':'true'},
              h('output',{className:'dcu-art dcu-shortcut-value','data-recording':recording,'data-keys':draft.stopShortcut.split('+').length,'aria-live':'polite','aria-label':t('extraStop')},...shortcutKeys),
              h('div',{className:'dcu-item-main'},title(t('extraStop'),'shortcutHint'),
                button(recording?'cancelRecord':draft.stopShortcut?'rerecord':'record',{className:'dcu-small',disabled:saving||!writable,onClick:()=>{setRecordMessage('');setRecording(!recording);}})))),
          recordMessage&&h('p',{role:'status',className:'dcu-hint'},t(recordMessage))),
        !writable&&h('p',{role:'status','data-tone':'error'},t(available?'unavailable':'notLoaded')),
        h('footer',{className:'dcu-footer'},h('span',{className:'dcu-status',role:'status','aria-live':'polite','data-tone':message?tone:undefined},message||t(dirty?'dirty':'clean')),
          h('div',{className:'dcu-actions'},button('discard',{disabled:!dirty||saving||recording,onClick:()=>{setDraft(saved);setDirty(false);setMessage('');setRecordMessage('');}}),button('save',{className:'dcu-primary',disabled:!dirty||disabled,onClick:save}))));
    }
    const actionKeys={snapshot:'see',screenshot:'see',accessibility_tree:'read',list_windows:'windows',find:'findControl',element_info:'read',click:'clickAction',double_click:'doubleClick',move:'movePointer',drag:'dragAction',scroll:'scrollAction',type_text:'typeAction',keypress:'keyAction',focus:'focusAction',invoke:'invokeAction',set_value:'valueAction',activate_window:'windowAction',wait:'waitAction',ocr:'ocrAction',wait_for:'verifyAction',close_window:'closeAction',move_window:'moveWindowAction',launch_app:'launchAction',health:'healthAction',tools:'toolsAction'};
    Object.assign(dictionaries.zh,{see:'查看了屏幕',read:'读取了界面控件',windows:'查看了打开的窗口',findControl:'查找了界面控件',clickAction:'点击了目标位置',doubleClick:'双击了目标位置',movePointer:'移动了鼠标',dragAction:'拖动了目标',scrollAction:'滚动了页面',typeAction:'输入了文本',keyAction:'发送了按键',focusAction:'聚焦了目标控件',invokeAction:'操作了目标控件',valueAction:'填写了控件内容',windowAction:'切换了目标窗口',waitAction:'等待了界面响应',ocrAction:'识别了屏幕文字',verifyAction:'检查了操作结果',closeAction:'请求关闭窗口',moveWindowAction:'移动了窗口',launchAction:'请求启动应用',healthAction:'检查了桌面服务',toolsAction:'查看了工具配置',working:'正在操作…',completed:'已完成',failedAction:'未完成',stoppedAction:'已停止',seriesTitle:'本轮桌面操作',sentOnly:'操作已发送，效果待确认',showDetails:'查看步骤和截图',searchSubmitted:'提交了搜索',searchObserved:'搜索了',seriesCount:'步操作',stepError:'操作失败',and:'，并'});
    Object.assign(dictionaries.en,{see:'Viewed the screen',read:'Read interface controls',windows:'Listed open windows',findControl:'Looked for controls',clickAction:'Clicked the target',doubleClick:'Double-clicked the target',movePointer:'Moved the pointer',dragAction:'Dragged the target',scrollAction:'Scrolled the page',typeAction:'Entered text',keyAction:'Sent a key press',focusAction:'Focused a control',invokeAction:'Operated a control',valueAction:'Filled in a control',windowAction:'Switched windows',waitAction:'Waited for the interface',ocrAction:'Read screen text',verifyAction:'Checked the result',closeAction:'Requested window close',moveWindowAction:'Moved a window',launchAction:'Requested app launch',healthAction:'Checked desktop service',toolsAction:'Viewed tool settings',working:'Working…',completed:'Completed',failedAction:'Incomplete',stoppedAction:'Stopped',seriesTitle:'Desktop activity',sentOnly:'Input sent; effect unconfirmed',showDetails:'Steps and screenshots',searchSubmitted:'Submitted a search for',searchObserved:'Searched for',seriesCount:'steps',stepError:'Action failed',and:', then '});
    const shortTool=name=>String(name||'').replace(/^(?:mcp__dsh-computer-use__)?windows_computer_use_/,'');
    const desktopTool=name=>/^(?:mcp__dsh-computer-use__)?windows_computer_use_(?!health$|tools$)[a-z_]+$/.test(name||'');
    const objectArgs=value=>{if(typeof value==='string')try{return JSON.parse(value);}catch{return {};}return value&&typeof value==='object'?value:{};};
    function receipt(message){
      for(const part of message?.content||[])if(part.type==='text'&&typeof part.text==='string')try{return JSON.parse(part.text);}catch{}
      return {};
    }
    const resultStatus=message=>message?.isError?((message.content||[]).some(part=>part.type==='text'&&/COMPUTER_USE_STOPPED_BY_USER/.test(part.text))?'stopped':'failed'):'completed';
    const mouseIcon=()=>h('svg',{viewBox:'0 0 24 24',width:17,height:17,fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true,style:{verticalAlign:'middle',flexShrink:0}},h('rect',{x:6,y:2,width:12,height:20,rx:6}),h('path',{d:'M12 2v7M6 10h12'}));
    const activityCss=`.dcu-activity{color:var(--dsw-alias-label-secondary,inherit);font-size:13px;line-height:1.6;margin:7px 0}.dcu-activity>summary{cursor:pointer;display:flex;align-items:center;gap:8px;list-style:none}.dcu-activity>summary::-webkit-details-marker{display:none}.dcu-activity .dcu-activity-label{color:var(--dsw-alias-label-primary,inherit)}.dcu-activity .dcu-activity-state{font-size:12px;opacity:.72;margin-left:4px}.dcu-activity[open]{padding-bottom:8px}.dcu-activity ol{margin:10px 0 4px 22px;padding-left:16px}.dcu-activity li{padding:3px 0}.dcu-activity pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:240px;overflow:auto}.dcu-activity .dcu-activity-note{font-size:12px;opacity:.75}.dcu-activity button{color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,#8885);border-radius:6px;padding:3px 8px;cursor:pointer}`;
    function actionText(call,t){
      const args=objectArgs(call.args),action=shortTool(call.name);
      let label=t(actionKeys[action]||'seriesTitle');
      if(['activate_window','close_window','move_window'].includes(action)&&args.windowTitle)label+='「'+String(args.windowTitle).slice(0,90)+'」';
      if(action==='find'&&args.query)label+='「'+String(args.query).slice(0,60)+'」';
      return label;
    }
    function seriesText(calls,t){
      const textCall=calls.find(c=>c.status==='completed'&&shortTool(c.name)==='type_text'&&typeof objectArgs(c.args).text==='string');
      const query=textCall?objectArgs(textCall.args).text.trim():'';
      const searchWindow=calls.find(c=>c.status==='completed'&&/搜索|search|bing|google|百度/i.test(String(objectArgs(c.args).windowTitle||receipt(c.message).window?.title||'')));
      const submitted=textCall&&calls.find(c=>c.seq>textCall.seq&&shortTool(c.name)==='keypress'&&(objectArgs(c.args).keys||[]).some(key=>/^enter$/i.test(key))&&c.status==='completed');
      if(searchWindow&&submitted&&query&&query.length<=100&&!/[\r\n]/.test(query)){
        const observed=calls.some(c=>c.seq>submitted.seq&&['screenshot','snapshot','ocr','wait_for'].includes(shortTool(c.name))&&c.status==='completed'&&(String(receipt(c.message).window?.title||'').includes(query)||(shortTool(c.name)==='wait_for'&&receipt(c.message).verification==='observed'&&objectArgs(c.args).query===query)));
        return t(observed?'searchObserved':'searchSubmitted')+'「'+query+'」';
      }
      const actions=[...new Set(calls.filter(c=>c.status==='completed').map(c=>actionText(c,t)))];
      return actions.slice(-3).join(t('and'))||t('seriesTitle');
    }
    function activityBody(call,renderFactorySlot,loadImage,t){
      const data=receipt(call.message),images=(call.message?.content||[]).filter(x=>x.type==='image'&&x.attachment);
      return h(React.Fragment,null,
        ['sent','dispatched'].includes(data.verification)&&h('div',{className:'dcu-activity-note'},t('sentOnly')),
        ['failed','stopped'].includes(call.status)&&h('div',{role:'status'},t(call.status==='stopped'?'stoppedAction':'stepError')),
        images.length>0&&renderFactorySlot&&loadImage&&renderFactorySlot('conversation.images.content',{images,loadImage,align:'start'}));
    }
    function MouseToolRow({toolName,phase,block,renderFactorySlot,loadImage,inspect,t}){
      const message=phase==='result'?block.message:undefined;
      const status=phase==='result'?resultStatus(message):'working';
      const call={name:toolName,args:block.call?.arguments??block.arguments,message,status};
      return h('details',{className:'dcu-activity','data-dcu-action':true},h('style',null,activityCss),h('summary',null,mouseIcon(),h('span',{className:'dcu-activity-label'},status==='working'?t('working'):actionText(call,t)),h('span',{className:'dcu-activity-state'},t(status==='failed'?'failedAction':status==='stopped'?'stoppedAction':status))),activityBody(call,renderFactorySlot,loadImage,t),inspect&&h('button',{type:'button',onClick:inspect},t('showDetails')));
    }
    function reduceSeries(state,event){
      const data=event.data||{};
      if(event.type==='tool/call'&&desktopTool(data.name))return {...state,calls:[...state.calls,{id:data.callId,name:data.name,args:data.arguments,seq:event.seq,status:'working'}]};
      if(event.type==='tool/result')return {...state,calls:state.calls.map(call=>call.id===data.message?.callId?{...call,message:data.message,status:resultStatus(data.message)}:call)};
      if(event.type==='turn/end')return {...state,ended:true,reason:data.reason?.kind||'completed'};
      return state;
    }
    const seriesDefinition={
      kind:'dcu-series',target:'chat',
      match:event=>['turn/start','turn/end','tool/call','tool/result'].includes(event.type)&&Number.isInteger(event.data?.turn)?{id:String(event.data.turn),role:'start'}:null,
      start:(_context,match)=>reduceSeries({calls:[],seq:match.event.seq,ended:false},match.event),
      update:(context,match)=>reduceSeries(context.state,match.event),
      buildViewNode:context=>!context.state?.ended||!context.state.calls.length?null:{key:context.key,kind:'dcu-series',id:context.id,target:'chat',anchorSeq:context.state.calls[0].seq,location:context.start?.location??{kind:'unresolved'},visibility:'visible',data:context.state}
    };
    function SeriesRow({node,t,renderFactorySlot,loadImage}){
      const state=node.data,status=state.reason==='aborted'||state.calls.some(c=>c.status==='stopped')?'stoppedAction':state.reason==='error'||state.calls.some(c=>c.status!=='completed')?'failedAction':'completed';
      return h('details',{className:'dcu-activity','data-dcu-series':true},h('style',null,activityCss),h('summary',null,mouseIcon(),h('span',{className:'dcu-activity-label'},seriesText(state.calls,t)),h('span',{className:'dcu-activity-state'},t(status)+' · '+state.calls.length+' '+t('seriesCount'))),h('ol',null,...state.calls.map(call=>h('li',{key:call.id},actionText(call,t),activityBody(call,renderFactorySlot,loadImage,t)))));
    }
    function registerActivity(ctx){
      ctx.slots.inject('tool.call.toolview',function*(){for(const name of allToolNames)for(const prefix of ['mcp__dsh-computer-use__windows_computer_use_','windows_computer_use_'])yield ctx.slots.register({name:'tool.call.toolview',key:prefix+name,locale:NS},MouseToolRow);});
      ctx.inject(['uiConversation'],owner=>{
        owner.uiConversation.events.register(seriesDefinition);
        ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'dcu-series',locale:NS},SeriesRow));
      });
    }
    // DSH 2.0 picks settings-nav icons by built-in section id and gives plugin sections a gear.
    // Mark this section's nav button so a stylesheet can draw a mouse instead; nothing React
    // renders is replaced. The settings panel is portaled into <body>, so only new top-level
    // layers are watched. A nav without this markup simply keeps the host's gear.
    const navMouse=`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="1.5" width="8" height="13" rx="4"/><path d="M8 1.5V6M4 6.75h8"/></svg>')}")`;
    function watchNavIcon(names){
      if(typeof document==='undefined'||typeof MutationObserver!=='function')return ()=>{};
      const style=document.createElement('style');
      style.textContent=`[data-dcu-nav]>svg:first-child{display:none}[data-dcu-nav]::before{content:'';flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:${navMouse} center/16px no-repeat;mask:${navMouse} center/16px no-repeat}`;
      document.head.append(style);
      const mark=root=>{for(const button of root.querySelectorAll('button[class*="navCell"]')){const mine=button.firstElementChild?.localName==='svg'&&names.includes(button.lastElementChild?.textContent);if(mine!==button.hasAttribute('data-dcu-nav'))button.toggleAttribute('data-dcu-nav',mine);}};
      const layers=new Map();
      // Only layers that arrive with a settings nav are observed, so chat updates cost nothing.
      const watch=node=>{if(node.nodeType!==1||layers.has(node)||!node.querySelector('button[class*="navCell"]'))return;const observer=new MutationObserver(()=>mark(node));observer.observe(node,{childList:true,subtree:true,characterData:true});layers.set(node,observer);mark(node);};
      const top=new MutationObserver(records=>{for(const record of records){record.addedNodes.forEach(watch);record.removedNodes.forEach(node=>{layers.get(node)?.disconnect();layers.delete(node);});}});
      top.observe(document.body,{childList:true});
      for(const node of document.body.children)watch(node);
      return ()=>{top.disconnect();for(const observer of layers.values())observer.disconnect();layers.clear();style.remove();for(const button of document.querySelectorAll('[data-dcu-nav]'))button.removeAttribute('data-dcu-nav');};
    }
    function apply(ctx) {
      ctx.effect(()=>ctx.locale.register(NS,dictionaries));
      ctx.effect(()=>watchNavIcon([dictionaries.zh.nav,dictionaries.en.nav]));
      registerActivity(ctx);
      const t=ctx.locale.bind?ctx.locale.bind(NS):key=>key;
      let mounted=false;
      let modernRemote;
      ctx.inject(['remote','remote.settings'],owner=>{modernRemote=owner.remote.settings;return ()=>{modernRemote=undefined;};});
      const mount=(scope,owner,namespace)=>{
      if(mounted)return;mounted=true;
      const connection=typeof scope.mutate==='function'?undefined:owner.connection;
      const savePatch=async patch=>{
        const current=scope.getSnapshot();
        if(current.status!==undefined&&current.status!=='ready')throw Error(t('notLoaded'));
        if(modernRemote&&owner.configForms){
          const response=await modernRemote.mutate(namespace,Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),current.revision);
          if(response.ok)owner.configForms.describe().acceptView(response.value);
          else await owner.configForms.describe().load();
          if(!response.ok)throw Error(response.error?.message||response.error?.code||t('persistFailed'));
        }else if(typeof scope.mutate==='function'){
          const accepted=await scope.mutate(Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),scope.getSnapshot().revision);
          if(!accepted)throw Error(t('persistFailed'));
        }else if(connection?.api?.settings?.mutate){
          const snapshot=scope.getSnapshot();
          const response=await connection.api.settings.mutate({ns:namespace,ops:Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),...(snapshot.revision===undefined?{}:{expectedRevision:snapshot.revision})});
          if(!response.result?.ok)throw Error(response.result?.message||response.result?.error||t('persistFailed'));
          await scope.load();
        }else{
          for(const [field,value]of Object.entries(patch))await scope.set(field,value);
        }
        const value=scope.getSnapshot().value??{};
        if(Object.entries(patch).some(([key,next])=>!equal(value[key],next)))throw Error(t('persistFailed'));
      };
      ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'computer-use',order:16,label:()=>t('nav'),locale:NS,inject:()=>({scope,savePatch,as:'section',idPrefix:'dcu-page'})},Card));
      ctx.slots.inject('plugins.item',()=>ctx.slots.register({name:'plugins.item',id:'dsh-computer-use',order:30,label:()=>t('nav'),locale:NS,inject:()=>({scope,savePatch,as:'section',idPrefix:'dcu-plugin'})},Card));
      ctx.slots.inject('settings.plugin.item',()=>ctx.slots.register({name:'settings.plugin.item',id:'dsh-computer-use',order:30,locale:NS,inject:()=>({scope,savePatch})},Card));
      };
      ctx.inject(['configForms'],owner=>mount(owner.configForms.get('mcp-dsh-computer-use'),owner,'mcp-dsh-computer-use'));
      ctx.inject(['settingsScope','connection','remote'],owner=>mount(owner.settingsScope.bind({namespace:'dsh-computer-use'}),owner,'dsh-computer-use'));
    }
    return {apply,inject:['slots','locale']};
  }
});
