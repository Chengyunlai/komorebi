const { app, BrowserWindow, ipcMain, dialog, clipboard, globalShortcut, Tray, Menu, nativeImage, screen, Notification, safeStorage, powerMonitor, session, net, systemPreferences, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const {sanitizeDanceStudy}=require('./dance-study.cjs');
const { readVRM, readAvatar } = require('./vrm-model.cjs');
const { Store } = require('./store.cjs');
const { TaskRunner } = require('./runner.cjs');
const { NeteaseMusic } = require('./music.cjs');
const { routeSubmission } = require('./submission.cjs');
const { BehaviorDirector } = require('./behavior.cjs');
const behavior = new BehaviorDirector();
const { MusicAudio } = require('./music-audio.cjs');
const {createMusicTrackBoundary}=require('./music-track-boundary.cjs');
const {createCaptureVisibility}=require('./capture-visibility.cjs');
const { DanceStream } = require('./dance-stream.cjs');
const { loadDanceLibrary } = require('./dance-library.cjs');
const { DEFAULT_BASE_URL, DEFAULT_MODEL, validateLlmConfig } = require('./llm.cjs');
const exec = promisify(execFile);
app.setName('Komorebi');
if (process.env.KOMOREBI_DATA_DIR) app.setPath('userData', process.env.KOMOREBI_DATA_DIR);
if (!app.requestSingleInstanceLock()) app.quit();
let danceStudy={available:false};
let petDrag = null, chatHeight = 128, chatTail = 'right';
let motionDiagnostics={streamId:null,samples:[]};
let motionLab, motionStudySamples=[],idleSamples=[];
let music, musicAudio, musicPanel, danceStream, petHeight = 440;
let board, pet, chat, tray, store, runner, quitting = false, captureBusy = false, speechProcess = null, speechController = null, sleepMode = false, screenLocked = false;
const captureVisibility=createCaptureVisibility({windows:()=>[board,pet,chat,musicPanel,motionLab],canRestore:window=>!quitting&&!screenLocked&&(![pet,chat,musicPanel].includes(window)||store.setting('petVisible',true))});
const root = path.join(__dirname, '..');
const captures = () => path.join(app.getPath('userData'), 'captures');
const safeAttachment = input => {
  if (!input) return null;
  const resolved = path.resolve(input);
  if (!resolved.startsWith(`${captures()}${path.sep}`) || !fs.existsSync(resolved)) throw new Error('这张附件已失效，请重新截取。');
  return resolved;
};
function send(channel, value) {
  for (const window of [board, pet, chat, musicPanel, motionLab]) if (window && !window.isDestroyed()) window.webContents.send(`komorebi:${channel}`, value);
}
function broadcast() { send('snapshot', store.snapshot()); }
function showBoard() {
  if(captureVisibility.active)return;
  if (!board) createBoard();
  board.show(); board.focus();
}
function lockWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
}
function createBoard() {
  board = new BrowserWindow({ title: '木漏日 · 配置与管理', show: false, width: 1150, height: 790, minWidth: 920, minHeight: 620,
    backgroundColor: '#f6f7f3', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 22, y: 21 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  lockWindow(board);
  board.loadFile(path.join(root, 'dist/index.html'));
  board.on('close', event => { if (!quitting) { event.preventDefault(); board.hide(); } });
}
function showMotionLab(){
  if(captureVisibility.active)return;
  if(!motionLab){
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width=Math.min(1240,area.width-40),height=Math.min(860,area.height-40);
    motionLab=new BrowserWindow({title:'木漏日 · 动作解剖',width,height,x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),minWidth:Math.min(1000,width),minHeight:Math.min(700,height),show:false,backgroundColor:'#f6f7f9',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    lockWindow(motionLab);motionLab.loadFile(path.join(root,'dist/index.html'),{query:{view:'motion-lab'}});
    motionLab.once('ready-to-show',()=>{console.log('[ML] ready-to-show');if(captureVisibility.active)return;motionLab.show();motionLab.focus();});motionLab.webContents.once('did-finish-load',()=>{console.log('[ML] did-finish-load visible',motionLab.isVisible());if(!captureVisibility.active&&!motionLab.isVisible())motionLab.show();});motionLab.on('closed',()=>motionLab=null);
  }else{motionLab.show();motionLab.focus();}
}
function positionPet(initial = false) {
  if (!pet) return;
  const current = pet.getBounds();
  const savedBounds = initial ? store.setting('petPosition', null) : null;
  const reference = Number.isFinite(savedBounds?.x) && Number.isFinite(savedBounds?.y) ? { ...current, x: savedBounds.x, y: savedBounds.y } : current;
  const area = (initial && !savedBounds ? screen.getPrimaryDisplay() : screen.getDisplayMatching(initial ? reference : current)).workArea;
  const width = Math.min(290, area.width), height = Math.min(petHeight, area.height);
  const saved = initial ? store.setting('petPosition', null) : null;
  const x = initial ? (Number.isFinite(saved?.x) ? saved.x : area.x + area.width - width - 10) : current.x;
  const y = initial ? (Number.isFinite(saved?.y) ? saved.y : area.y + area.height - height - 10) : current.y;
  const next = { x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(y, area.y + area.height - height)), width, height };
  if (Object.keys(next).some(key => current[key] !== next[key])) pet.setBounds(next);
}
function keepAboveDesktop(window) {
  window.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}
function createPet() {
  pet = new BrowserWindow({ title: '木漏日', width: 290, height: 440, transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: store.setting('petVisible', true),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true } });
  lockWindow(pet);
  keepAboveDesktop(pet);
  pet.loadFile(path.join(root, 'dist/index.html'), { query: { view: 'pet' } });
  positionPet(true);
  pet.on('move', () => { if (chat?.isVisible()) positionChat(); });
  pet.on('moved', () => positionPet());
  pet.on('close', event => { if (!quitting) { event.preventDefault(); setPetVisible(false); } });
}
function endPetDrag() {
  const moved = Boolean(petDrag?.moved); petDrag = null;
  if (moved && pet && !pet.isDestroyed()) {
    positionPet();
    const { x, y } = pet.getBounds(); store.setSetting('petPosition', { x, y });
  }
  return { moved };
}
function beginPetDrag(point) {
  endPetDrag();
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('无效拖动位置。');
  pet.setIgnoreMouseEvents(false);
  petDrag = { cursor: point, bounds: pet.getBounds(), moved: false };
}
function movePetDrag(point) {
  if (!petDrag || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const dx = point.x - petDrag.cursor.x, dy = point.y - petDrag.cursor.y;
  if (!petDrag.moved && Math.hypot(dx, dy) < 6) return;
  petDrag.moved = true;
  pet.setPosition(Math.round(petDrag.bounds.x + dx), Math.round(petDrag.bounds.y + dy));
}
function showPetMenu() {
  endPetDrag();
  Menu.buildFromTemplate([
    { label: '和我说说', click: showChat },
    { label: '音乐 · 网易云', click: showMusic },
    { label: '动作解剖 · 实验', click: showMotionLab },
    { label: '带上剪贴板', click: handoffClipboard },
    { label: '框选截图', click: handoffCapture },
    { type: 'separator' },
    { label: '配置与管理', click: showBoard },
    { label: '隐藏伙伴', click: () => setPetVisible(false) }
  ]).popup({ window: pet });
}
function positionChat() {
  if (!chat || !pet) return;
  const bounds = pet.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(320, area.width), height = Math.min(chatHeight, area.height);
  const left = bounds.x - width + 100;
  chatTail = left >= area.x ? 'right' : 'left';
  const x = chatTail === 'right' ? left : bounds.x + bounds.width - 100;
  chat.setBounds({ x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y + 90, area.y + area.height - height)), width, height });
  chat.webContents.send('komorebi:chat-side', chatTail);
}
function showChat(revealResult = false) {
  if(captureVisibility.active)return;
  setPetVisible(true); positionChat(); chat.show(); chat.focus();
  chat.webContents.send('komorebi:chat-open', { revealResult: revealResult === true, tail: chatTail });
}
function createChat() {
  chat = new BrowserWindow({ title: '和木漏日说说', width: 320, height: 128, show: false,
    frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#00000000', transparent: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  lockWindow(chat); keepAboveDesktop(chat);
  chat.loadFile(path.join(root, 'dist/index.html'), { query: { view: 'chat' } });
  chat.on('close', event => { if (!quitting) { event.preventDefault(); chat.hide(); } });
  chat.on('blur', () => {
    if (!quitting && store.setting('dismissOnBlur', true)) chat.hide();
  });
}
function showMusic() {
  if(captureVisibility.active)return;
  setPetVisible(true);
  if (!musicPanel) {
    musicPanel = new BrowserWindow({ title:'木漏日 · 网易云音乐',width:330,height:460,show:false,frame:false,resizable:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,skipTaskbar:true,alwaysOnTop:true,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true} });
    lockWindow(musicPanel); keepAboveDesktop(musicPanel);
    musicPanel.loadFile(path.join(root,'dist/index.html'),{query:{view:'music'}});
    musicPanel.on('blur',()=>{if(store.setting('dismissOnBlur',true))musicPanel.hide();});
    musicPanel.on('close',event=>{if(!quitting){event.preventDefault();musicPanel.hide();}});
  }
  const bounds=pet.getBounds(),area=screen.getDisplayMatching(bounds).workArea;
  musicPanel.setPosition(Math.max(area.x,Math.min(bounds.x-230,area.x+area.width-330)),Math.max(area.y,Math.min(bounds.y+90,area.y+area.height-460)));
  musicPanel.show();musicPanel.focus();
}
let lastMusicStatus='idle';
const trackChanged=createMusicTrackBoundary();
function musicChanged(state) {
  if(trackChanged(state)) {
    musicAudio?.resetTrack();
    if(danceStream?.running)danceStream.stop();
  }
  // Auto-follow: whenever NetEase starts playing and audio capture is off, start it.
  if(state.status==='playing'&&lastMusicStatus!=='playing'&&musicAudio?.state.mode==='off'&&store.setting('musicEnabled',true))musicAudio.start('netease').catch(()=>{});
  // Stop capturing when playback stops so we never keep the tap open silently.
  if(state.status!=='playing'&&musicAudio?.state.mode==='netease')musicAudio.stop();
  // Daily playback uses the motion library. Research generation starts only explicitly.
  if(state.status!=='playing'&&danceStream?.running)danceStream.stop();
  lastMusicStatus=state.status;
  const height=state.title||musicAudio?.state.mode==='demo'?500:440;
  if(height!==petHeight){petHeight=height;positionPet();if(chat?.isVisible())positionChat();}
  send('music',state);
}
async function openMusicPlayer() {
  const candidates=[path.join('/Applications','NeteaseMusic.app'),path.join(os.homedir(),'Applications/NeteaseMusic.app')];
  const installed=candidates.find(file=>fs.existsSync(file));
  if(installed){const error=await shell.openPath(installed);if(error)throw new Error('网易云音乐未能打开，请手动启动客户端。');return;}
  await shell.openExternal('https://music.163.com/#/download');
}
async function handoffClipboard() {
  showChat();
  try { chat.webContents.send('komorebi:draft', await clipboardDraft()); }
  catch (error) { petMessage(error.message); }
}
async function handoffCapture() {
  try { const draft = await captureRegion(); if (draft) { showChat(); chat.webContents.send('komorebi:draft', draft); } }
  catch (error) { showChat(); petMessage(error.message); }
}
function setPetVisible(visible) {
  store.setSetting('petVisible', Boolean(visible));
  if (visible) {if(!captureVisibility.active)pet.showInactive();} else { endPetDrag(); pet.hide(); chat?.hide(); musicPanel?.hide(); }
  broadcast();
}
function petMessage(text) { send('pet-message', text); }
function stopSpeech() {
  speechController?.abort(); speechController = null;
  speechProcess?.kill(); speechProcess = null;
  send('speech', { stop: true });
}
async function speak(text, force = false) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有可朗读的文字。');
  const mode = store.setting('speech', 'off');
  if (!force && (mode === 'off' || store.setting('focus', false))) return;
  stopSpeech();
  const short = text.replace(/```[\s\S]*?```/g, '代码已放在结果面板。').replace(/[#*_`]/g, '').slice(0, 260);
  if (mode === 'mimo') {
    const encrypted = store.setting('mimoKey');
    if (!encrypted) throw new Error('先在设置里保存 MiMo API Key。');
    const key = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    const controller = new AbortController(); speechController = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await net.fetch('https://api.xiaomimimo.com/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'api-key': key },
        body: JSON.stringify({ model: 'mimo-v2.5-tts', messages: [
          { role: 'user', content: '温柔自然的年轻女声，轻松陪伴，语速适中，清晰简短。' },
          { role: 'assistant', content: short }], audio: { format: 'wav', voice: store.setting('voice', 'mimo_default') } })
      });
      if (!response.ok) throw new Error(`MiMo 语音请求失败（${response.status}），请检查 Key、音色和额度。`);
      const data = await response.json();
      const audio = data.choices?.[0]?.message?.audio?.data;
      if (!audio) throw new Error('MiMo 没有返回音频，请检查所选音色。');
      send('speech', { audio: `data:audio/wav;base64,${audio}` });
    } finally { clearTimeout(timeout); if (speechController === controller) speechController = null; }
  } else {
    if (process.platform !== 'darwin') throw new Error('系统语音目前仅接通 macOS。');
    const child = spawn('/usr/bin/say', ['-v', 'Tingting', short], { stdio: 'ignore' });
    speechProcess = child;
    await new Promise((resolve,reject) => {
      child.once('error',() => reject(new Error('系统语音暂不可用，可以试试 MiMo。')));
      child.once('close',(code,signal) => {
        if(speechProcess===child)speechProcess=null;
        if(code===0||signal)resolve();else reject(new Error('系统语音未能播放，请检查 Tingting 音色。'));
      });
    });
  }
}
async function clipboardDraft() {
  const items = await clipboard.read();
  const imageItem = items.find(item => item.types.some(type => type.startsWith('image/')));
  if (imageItem) {
    const type = imageItem.types.find(type => type === 'image/png') || imageItem.types.find(type => type.startsWith('image/'));
    const blob = await imageItem.getType(type);
    if (blob.size > 12 * 1024 * 1024) throw new Error('图片超过 12 MB，请缩小截图范围。');
    const image = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
    if (image.isEmpty()) throw new Error('这张图片暂时无法读取，请重新截图。');
    const name = path.join(captures(), `${randomUUID()}.png`);
    const buffer = image.toPNG();
    if (buffer.length > 12 * 1024 * 1024) throw new Error('图片超过 12 MB，请缩小截图范围。');
    fs.writeFileSync(name, buffer);
    return { context: '', attachment: name, preview: image.resize({ width: 600 }).toDataURL(), source: '剪贴板图片' };
  }
  const text = await clipboard.readText();
  if (!text.trim()) throw new Error('剪贴板里还没有文字或图片。');
  if (text.length > 60000) throw new Error('剪贴板内容太长，请复制与问题相关的片段。');
  return { context: text, attachment: null, preview: null, source: '剪贴板文字' };
}
async function captureRegion() {
  if (captureBusy) return null;
  if (process.platform !== 'darwin') throw new Error('当前框选入口适用于 macOS；其他平台可以先复制截图。');
  if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') throw new Error('框选需要在系统设置中允许木漏日录制屏幕。也可以先用系统截图，再从剪贴板交办。');
  captureBusy = true;
  endPetDrag();
  const restoreWindows=captureVisibility.acquire();
  const file = path.join(captures(), `${randomUUID()}.png`);
  try {
    await new Promise(resolve => setTimeout(resolve, 220));
    await exec('/usr/sbin/screencapture', ['-i', '-x', file], { timeout: 120000 });
    if (!fs.existsSync(file)) return null;
    const image = nativeImage.createFromPath(file);
    if (image.isEmpty()) { fs.rmSync(file, { force: true }); return null; }
    return { context: '', attachment: file, preview: image.resize({ width: 600 }).toDataURL(), source: '框选截图' };
  } catch (error) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    if (error.code === 1) return null;
    throw new Error('截图未完成。请在系统设置中允许屏幕录制，然后重试。');
  } finally {
    captureBusy = false;restoreWindows();
  }
}
function findCodex() {
  const saved = store.setting('codexPath');
  if (saved && fs.existsSync(saved)) return saved;
  const roots = ['/opt/homebrew/bin/codex','/usr/local/bin/codex'];
  const versions = path.join(os.homedir(), '.nvm/versions/node');
  if (fs.existsSync(versions)) roots.push(...fs.readdirSync(versions).sort().reverse().map(v => path.join(versions,v,'bin/codex')));
  return roots.find(p => fs.existsSync(p)) || 'codex';
}
function llmPreferences() {
  return { provider: store.setting('llmProvider', 'codex'), baseUrl: store.setting('llmBaseUrl', DEFAULT_BASE_URL), model: store.setting('llmModel', DEFAULT_MODEL) };
}
function llmRuntimeConfig() {
  const config = llmPreferences();
  if (config.provider === 'volcengine') {
    try { const encrypted = store.setting('llmKey'); config.key = encrypted ? safeStorage.decryptString(Buffer.from(encrypted, 'base64')) : ''; }
    catch { throw new Error('火山引擎 Key 解密失败，请在设置中重新保存。'); }
  }
  return config;
}
function saveLlmConfig(input) {
  if (runner?.active) throw new Error('请先等待当前任务结束或停止任务，再切换模型。');
  const config = validateLlmConfig(input);
  const key = typeof input.key === 'string' ? input.key.trim() : '';
  if (key.length > 1000) throw new Error('API Key 格式无效。');
  if (config.provider === 'volcengine' && !key && !store.setting('llmKey')) throw new Error('请填写火山引擎 API Key。');
  if (key && !safeStorage.isEncryptionAvailable()) throw new Error('系统加密存储不可用，暂不保存 Key。');
  store.db.exec('BEGIN');
  try {
    if (key) store.setSetting('llmKey', safeStorage.encryptString(key).toString('base64'));
    store.setSetting('llmBaseUrl', config.baseUrl); store.setSetting('llmModel', config.model); store.setSetting('llmProvider', config.provider);
    store.db.exec('COMMIT');
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  broadcast(); return { ...config, hasKey: Boolean(store.setting('llmKey')) };
}
async function decideBehavior(text){
  const result=await behavior.decide(text);
  if(result.accepted){send('behavior',result.state);pet?.webContents.send('komorebi:pet-message',result.state.label);if(['gentle','energetic'].includes(result.state.choice)&&music?.state.status==='playing'&&musicAudio?.state.mode==='off')await musicAudio.start('netease');}
  return result;
}
function registerIPC() {
  const handlers = {
    snapshot: () => store.snapshot(),
    danceStudySnapshot:()=>danceStudy,
    danceStudyReport:report=>{const result=sanitizeDanceStudy(report);if(result)danceStudy=result},
    showMotionLab,
    importAvatar: async () => {
      const result=await dialog.showOpenDialog(board,{title:'导入本机 VRM 角色',properties:['openFile'],filters:[{name:'VRM 角色',extensions:['vrm']}]});if(result.canceled)return false;
      const resource=readVRM(result.filePaths[0]);if(!resource)throw Error('模型不存在');const folder=path.join(app.getPath('userData'),'local-models');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'Cute_Model.vrm'),resource.bytes);
      pet?.webContents.reload();return resource.info;
    },
    motionAvatar: () => readAvatar(app.getPath('userData')),
    motionReference: () => {
      const file=path.join(app.getPath('userData'),'research-references','dance-short.bvh');
      if(!fs.existsSync(file))return {text:null};
      if(fs.statSync(file).size>12*1024*1024)throw Error('参考文件过大');
      return {text:fs.readFileSync(file,'utf8'),license:'CC BY-NC 4.0',source:'Bandai Namco Research',revision:'74ead3ba1ae4696404e6086233779f60de8bf9ef'};
    },
    motionLabReport: report => {
      if(!report||!['live2d','skeleton','retarget','vrm'].includes(report.view)||!Number.isFinite(report.time)||!Number.isFinite(report.parity))return;
      const actual=Object.fromEntries(['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamArmLA','ParamArmRA'].filter(k=>Number.isFinite(report.actual?.[k])).map(k=>[k,report.actual[k]]));
      motionStudySamples.push({vrm:report.view==='vrm'?Object.fromEntries(['frame','bones','maxDirectionError'].filter(k=>Number.isFinite(report.vrm?.[k])).map(k=>[k,report.vrm[k]])):undefined,view:report.view,motion:/^(hiyori_m0[1-8]|bvh-upperbody)$/.test(report.motion)?report.motion:null,gain:Number.isFinite(report.gain)?Math.min(2,Math.max(0,report.gain)):1,mirror:Boolean(report.mirror),time:report.time,playing:Boolean(report.playing),physics:Boolean(report.physics),layers:Object.fromEntries(['head','body','arms','face','other'].map(k=>[k,Boolean(report.layers?.[k])])),parity:report.parity,actual});
      motionStudySamples=motionStudySamples.slice(-20);fs.writeFileSync(path.join(app.getPath('userData'),'motion-study-diagnostics.json'),JSON.stringify(motionStudySamples));
    },
    behaviorSnapshot: () => behavior.state,
    behaviorDecide: decideBehavior,
    idleMotionReport: report => {
      if(!['hiyori_m05','original-idle'].includes(report?.source)||![report.time,report.weight,...(report.head||[]),...(report.body||[])].every(Number.isFinite)||report.head?.length!==3||report.body?.length!==3)return;
      idleSamples.push({source:report.source,time:report.time,weight:report.weight,head:report.head,body:report.body});idleSamples=idleSamples.slice(-20);fs.writeFileSync(path.join(app.getPath('userData'),'idle-motion-diagnostics.json'),JSON.stringify(idleSamples));
    },
    musicMotionReport: report => {
      if(!report||(!['demo','netease','system'].includes(musicAudio.state.mode)&&!['gentle','energetic','stop'].includes(report.behavior))||typeof report.streamId!=='string'||report.streamId.length>80)return;
      const keys=['headX','headY','headZ','bodyX','bodyZ','leftArm','rightArm','rootAngle'];
      if(![report.audioTime,report.strength,report.naturalCalls,...keys.map(key=>report.values?.[key])].every(Number.isFinite))return;
      if(motionDiagnostics.streamId!==report.streamId)motionDiagnostics={streamId:report.streamId,samples:[]};
      motionDiagnostics.samples.push({renderer:report.renderer==='vrm'?'vrm':'live2d',phrase:report.phrase?{beat:Number.isFinite(report.phrase.beat)?report.phrase.beat:0,musicalMode:['quiet','flow','drive','rising','settling'].includes(report.phrase.musicalMode)?report.phrase.musicalMode:null,arrangement:Number.isSafeInteger(report.phrase.arrangement)?report.phrase.arrangement:0,accent:Number.isFinite(report.phrase.accent)?report.phrase.accent:0,phase:Number.isFinite(report.phrase.phase)?report.phrase.phase:0,bpm:Number.isFinite(report.phrase.bpm)?report.phrase.bpm:0,support:['left','right','double'].includes(report.phrase.support)?report.phrase.support:null,timing:['tracking','estimated','preview'].includes(report.phrase.timing)?report.phrase.timing:null}:undefined,clipCount:Number.isSafeInteger(report.clipCount)?report.clipCount:0,footError:Number.isFinite(report.footError)?report.footError:null,joints:report.renderer==='vrm'?Object.fromEntries(['leftElbow','rightElbow','leftKnee','rightKnee'].filter(k=>Number.isFinite(report.joints?.[k])).map(k=>[k,report.joints[k]])):undefined,motionMode:['audio','waiting','preview'].includes(report.motionMode)?report.motionMode:'unknown',primitive:['rest','open-arms','arm-flick','alternate-reach','preview','step-touch','cross-open','diagonal-reach','knee-drive','body-drop','phrase-A','phrase-B','phrase-C','phrase-D','phrase-E','phrase-F'].includes(report.primitive)?report.primitive:'unknown',eventCount:Number.isSafeInteger(report.eventCount)?report.eventCount:0,behavior:report.behavior||'default',audioTime:report.audioTime,strength:report.strength,enabled:Boolean(report.enabled),reducedMotion:Boolean(report.reducedMotion),naturalCalls:report.naturalCalls,values:Object.fromEntries(keys.map(key=>[key,report.values[key]]))});
      if(motionDiagnostics.samples.length>80)motionDiagnostics.samples.shift();
      fs.writeFileSync(path.join(app.getPath('userData'),['demo','netease','system'].includes(musicAudio.state.mode)?'music-motion-diagnostics.json':'behavior-motion-diagnostics.json'),JSON.stringify(motionDiagnostics));
    },
    musicAudioSnapshot: () => musicAudio.snapshot(),
    musicAudioStart: mode => musicAudio.start(mode),
    musicAudioStop: () => musicAudio.stop(),
    musicAudioReady: () => musicAudio.readyDemo(),
    danceLibrary: () => loadDanceLibrary(path.join(app.getPath('userData'), 'dance-library')),
    danceStreamStart: () => danceStream.start(),
    danceStreamStop: () => danceStream.stop(),
    danceStreamSnapshot: () => danceStream.snapshot(),
    musicSnapshot: () => music?.snapshot() || {status:'idle',title:'',lines:[]},
    showMusic,
    hideMusic: () => musicPanel?.hide(),
    openMusicPlayer,
    musicControl: async action => {
      try { await music.command(action); } catch(error) { throw new Error(error.message.includes('不是网易云')||error.message.includes('预览')?error.message:'音乐控制暂未完成，请确认网易云音乐正在播放。'); }
    },
    musicRefresh: () => {if(store.setting('musicEnabled',true))music.start();},
    musicPreview: enabled => {
      if(enabled)music.preview();else if(store.setting('musicEnabled',true))music.start();else music.stop();
    },
    saveLlmConfig,
    diagnostics: async () => {
      const config = llmPreferences();
      if (config.provider === 'volcengine') {
        let available = false;
        try { await exec(findCodex(), ['--version'], { timeout: 12000, env: process.env }); available = true; } catch {}
        const ready = available && Boolean(store.setting('llmKey'));
        return { backend: '火山引擎', provider: config.provider, model: config.model, baseUrl: config.baseUrl, ready, loggedIn: ready, available, path: findCodex() };
      }
      try {
        const { stdout, stderr } = await exec(findCodex(), ['login','status'], { timeout: 12000, env: process.env });
        return { backend: 'Codex CLI', provider: 'codex', available: true, loggedIn: /logged in/i.test(`${stdout} ${stderr}`), path: findCodex() };
      } catch (error) {
        const message = `${error.stdout || ''} ${error.stderr || ''}`;
        return { backend: 'Codex CLI', provider: 'codex', available: error.code !== 'ENOENT', loggedIn: /logged in/i.test(message), path: findCodex() };
      }
    },
    chooseProject: async () => {
      const result = await dialog.showOpenDialog(chat?.isFocused() ? chat : board, { title: '选择要一起工作的项目', properties: ['openDirectory'] });
      if (result.canceled) return null;
      const dir = result.filePaths[0];
      const project = store.addProject(path.basename(dir), dir);
      store.setSetting('selectedProject', project.id); broadcast(); return project;
    },
    selectProject: id => { store.project(id); store.setSetting('selectedProject', id); broadcast(); },
    submit: input => routeSubmission(input,{decide:decideBehavior,startTask: input => {
      const task = runner.start({ projectId: input.projectId, instruction: input.instruction, context: input.context, attachment: safeAttachment(input.attachment) });
      broadcast(); return task;
    }}),
    cancel: id => { runner.cancel(id); broadcast(); },
    clipboard: clipboardDraft,
    capture: captureRegion,
    captureCancel: () => null,
    copy: async text => { if (typeof text !== 'string' || text.length > 200000) throw new Error('复制内容无效。'); await clipboard.writeText(text); },
    saveNote: input => { const note = store.saveNote(input); broadcast(); return note; },
    deleteNote: (id, projectId) => { store.deleteNote(id, projectId); broadcast(); },
    searchNotes: (projectId, query) => store.notes(projectId, query),
    exportNotes: async projectId => {
      const project = store.project(projectId);
      const notes = store.notes(projectId);
      const result = await dialog.showSaveDialog(board, { title: '导出项目结论', defaultPath: `${project.name}-项目结论.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
      if (result.canceled) return null;
      const body = notes.map(n => `## ${n.title}\n\n${n.content}\n\n来源：${n.source}\n更新时间：${n.updated_at}`).join('\n\n---\n\n');
      fs.writeFileSync(result.filePath, `# ${project.name} 项目结论\n\n${body || '尚无已保存的结论。'}\n`, 'utf8');
      return result.filePath;
    },
    setting: (key, value) => {
      if (['focus','dismissOnBlur','musicEnabled','musicLyrics','musicDance'].includes(key)) { if (typeof value !== 'boolean') throw new Error('无效设置。'); }
      else if(key === 'musicTempo' && (!Number.isFinite(value)||value<60||value>160)) throw new Error('律动速度应在60至160之间。');
      else if (key === 'speech' && !['off','system','mimo'].includes(value)) throw new Error('无效语音方式。');
      else if (key === 'voice' && (typeof value !== 'string' || value.length > 80)) throw new Error('无效音色。');
      else if (!['focus','dismissOnBlur','musicEnabled','musicLyrics','musicDance','musicTempo','speech','voice'].includes(key)) throw new Error('无效设置。');
      store.setSetting(key,value);
      if (key === 'speech' || (key === 'focus' && value === true)) stopSpeech();
      if (key === 'dismissOnBlur' && value && chat?.isVisible() && !chat.isFocused()) chat.hide();
      if (key === 'musicEnabled') {if(value)music.start();else{music.stop();musicAudio.stop();}}
      if (key === 'musicLyrics') music.setLyrics(value);
      broadcast();
    },
    saveMimoKey: key => {
      if (typeof key !== 'string' || key.length > 1000) throw new Error('无效 API Key。');
      if (key.trim() && !safeStorage.isEncryptionAvailable()) throw new Error('系统加密存储不可用，暂不保存 Key。');
      store.setSetting('mimoKey',key.trim() ? safeStorage.encryptString(key.trim()).toString('base64') : null); broadcast();
    },
    speak: text => speak(text, true),
    chooseBackend: async () => {
      const result = await dialog.showOpenDialog(board,{ title: '选择 Codex 可执行文件', properties: ['openFile'] });
      if (!result.canceled) { store.setSetting('codexPath',result.filePaths[0]); runner.binary = findCodex(); }
      return !result.canceled;
    },
    showBoard,
    showChat,
    chatLayout: height => {
      if (!Number.isFinite(height)) return;
      chatHeight = Math.max(128, Math.min(440, Math.round(height))); positionChat();
    },
    retryTask: id => {
      const task = store.snapshot().tasks.find(t => t.id === id);
      if (!task) throw new Error('这件事已不存在。');
      store.setSetting('selectedProject', task.project_id); broadcast(); showChat();
      chat.webContents.send('komorebi:draft', { instruction: task.instruction, context: task.context, attachment: task.attachment, source: '重新交办' });
    },
    hideChat: () => chat.hide(),
    hideBoard: () => board.hide(),
    petVisible: setPetVisible,
    beginPetDrag,
    movePetDrag,
    endPetDrag,
    petMenu: showPetMenu,
    setClickThrough: ignore => {
      // A renderer can change only its own pet window's mouse handling.
      pet.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
    }
  };
  for (const [name, fn] of Object.entries(handlers)) ipcMain.handle(`komorebi:${name}`, (event, ...args) => {
    if(quitting||event.sender.isDestroyed())return;
    const id=window=>window&&!window.isDestroyed()?window.webContents.id:null;
    const boardId=id(board),petId=id(pet),chatId=id(chat),musicId=id(musicPanel),labId=id(motionLab);
    if (![boardId,petId,chatId,musicId,labId].includes(event.sender.id)) throw new Error('无效窗口。');
    if(event.sender.id===labId&&!['danceStudySnapshot','motionReference','motionLabReport','motionAvatar','musicAudioStart','musicAudioStop','musicAudioSnapshot','musicAudioReady','danceStreamStart','danceStreamStop','danceStreamSnapshot'].includes(name))throw Error('动作解剖窗口不访问任务与用户资料。');
    if(name==='importAvatar'&&event.sender.id!==boardId)throw Error('请从配置管理窗口导入角色。');
    if (name === 'saveLlmConfig' && event.sender.id !== boardId) throw new Error('请从配置管理窗口修改模型。');
    if (name === 'chatLayout' && event.sender.id !== chatId) return;
    if (['danceStudyReport','idleMotionReport','musicMotionReport','setClickThrough','beginPetDrag','movePetDrag','endPetDrag','petMenu'].includes(name) && event.sender.id !== petId) return;
    return fn(...args);
  });
}
app.whenReady().then(() => {
  app.accessibilitySupportEnabled = true;
  const nodePaths = ['/opt/homebrew/bin','/usr/local/bin',...((process.env.PATH || '').split(path.delimiter))];
  const versions = path.join(os.homedir(), '.nvm/versions/node');
  if (fs.existsSync(versions)) nodePaths.unshift(...fs.readdirSync(versions).sort().reverse().map(v => path.join(versions,v,'bin')));
  process.env.PATH = [...new Set(nodePaths)].join(path.delimiter);
  fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.mkdirSync(captures(), { recursive: true });
  store = new Store(path.join(app.getPath('userData'), 'komorebi.sqlite'));
  if (!store.snapshot().projects.length) {
    const project = store.addProject('开始一起工作', root); store.setSetting('selectedProject',project.id);
  }
  if (process.env.MOZI_LLM_PROVIDER === 'volcengine' && process.env.HARNESS_LLM_API_KEY) {
    saveLlmConfig({ provider: 'volcengine', baseUrl: process.env.HARNESS_LLM_BASE_URL || DEFAULT_BASE_URL, model: process.env.HARNESS_LLM_MODEL || DEFAULT_MODEL, key: process.env.HARNESS_LLM_API_KEY });
    delete process.env.HARNESS_LLM_API_KEY;
  }
  runner = new TaskRunner(store, { binary: findCodex(), getLlmConfig: llmRuntimeConfig });
  runner.on('change', broadcast);
  runner.on('settled', task => {
    const text = task.status === 'completed' ? '这件事处理好了，点我就能看结果。' : task.status === 'failed' ? '这次遇到了一点问题，点开看看吧。' : '好，已经停下来了。';
    petMessage(text);
    if (!store.setting('focus',false) && task.status !== 'cancelled') {
      if (!board.isFocused() && !chat.isFocused() && Notification.isSupported()) new Notification({title:'木漏日',body:text,silent:true}).show();
      speak(text).catch(() => petMessage('结果已准备好，语音暂不可用。'));
    }
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(false));
  music = new NeteaseMusic({nativeRoot:path.join(root,'native/mediaremote'),fetchFn:(...args)=>net.fetch(...args),lyrics:store.setting('musicLyrics',true)});
  music.on('change',musicChanged);
  musicAudio=new MusicAudio({nativeRoot:path.join(root,'native/audio-tap')});
  danceStream=new DanceStream({venvPython:path.join(os.homedir(),'.komorebi-motion-venv/bin/python'),serverScript:path.join(root,'scripts/bailando-stream-server.py'),audio:musicAudio});
  danceStream.on('segment',segment=>send('dance-stream',segment));
  danceStream.on('status',status=>send('dance-stream-status',status));
  musicAudio.on('change',state=>{const height=music?.state.title||state.mode==='demo'?500:440;if(height!==petHeight){petHeight=height;positionPet();}send('music-signal',state);});
  musicAudio.on('audio',data=>{if(pet&&!pet.isDestroyed())pet.webContents.send('komorebi:music-audio',data);});
  createBoard(); createPet(); createChat(); registerIPC();
  if(store.setting('musicEnabled',true))music.start();
  const icon = nativeImage.createFromPath(path.join(root,'dist/tray.png')).resize({width:18,height:18});
  if (app.dock) app.dock.setIcon(path.join(root,'dist/icon.png'));
  tray = new Tray(icon); tray.setToolTip('木漏日 · 随时在这里');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'音乐 · 网易云',click:showMusic},
    {label:'动作解剖 · 实验',click:showMotionLab},
    {label:'配置与管理',click:showBoard},
    {label:'交办剪贴板内容  ⌥Space',click:handoffClipboard},
    {label:'框选屏幕  ⌥⇧S',click:handoffCapture},
    {label:'显示 / 隐藏伙伴',click:() => setPetVisible(!pet.isVisible())},
    {type:'separator'}, {label:'退出木漏日',click:() => {quitting=true;app.quit();}}
  ]));
  tray.on('click',showChat);
  globalShortcut.register('Alt+Space', handoffClipboard);
  globalShortcut.register('Alt+Shift+S', handoffCapture);
  globalShortcut.register('Alt+Shift+H', () => setPetVisible(!pet.isVisible()));
  screen.on('display-removed',() => { positionPet(); positionChat(); });
  screen.on('display-metrics-changed',() => { positionPet(); positionChat(); });
  powerMonitor.on('lock-screen',() => {screenLocked=true;sleepMode=pet.isVisible()||(captureVisibility.active&&store.setting('petVisible',true));pet.hide();chat.hide();musicPanel?.hide();musicAudio?.stop();stopSpeech();});
  powerMonitor.on('unlock-screen',() => {screenLocked=false;if(sleepMode&&!captureVisibility.active&&store.setting('petVisible',true))pet.showInactive();});
  app.on('activate',() => {if(!captureVisibility.active&&![board,chat,musicPanel,motionLab].some(window=>window?.isVisible()))setPetVisible(true);});
  // Explicit developer smoke-test commands for an already running pet.
  app.on('second-instance',(_event,args) => {
    if(args.includes('--music-demo'))musicAudio.start('demo').catch(console.error);
    else if(args.includes('--music-audio'))musicAudio.start('netease').catch(console.error);
    else if(args.includes('--motion-lab'))showMotionLab();
    else setPetVisible(true);
  });
  if(process.argv.includes('--motion-lab'))showMotionLab();
}).catch(error => { dialog.showErrorBox('木漏日未能启动',error.message); app.quit(); });
app.on('before-quit',() => { quitting=true;endPetDrag(); music?.stop(); musicAudio?.stop(); danceStream?.stop(); runner?.shutdown(); stopSpeech(); });
app.on('will-quit',() => { globalShortcut.unregisterAll();store?.close(); });
app.on('window-all-closed',() => {});

app.on('before-quit',()=>behavior.stop());
