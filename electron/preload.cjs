const { contextBridge, ipcRenderer } = require('electron');
const methods = ['danceStudySnapshot','danceStudyReport','idleMotionReport','importAvatar','motionAvatar','showMotionLab','motionReference','motionLabReport','behaviorSnapshot','behaviorDecide','snapshot','musicMotionReport','musicAudioSnapshot','musicAudioStart','musicAudioStop','musicAudioReady','danceStreamStart','danceStreamStop','danceStreamSnapshot','danceLibrary','musicSnapshot','showMusic','hideMusic','openMusicPlayer','musicControl','musicRefresh','musicPreview','chooseProject','selectProject','submit','cancel','clipboard','capture','copy','saveNote','deleteNote','searchNotes','exportNotes','setting','saveMimoKey','saveLlmConfig','speak','chooseBackend','diagnostics','showBoard','showChat','chatLayout','hideChat','retryTask','hideBoard','petVisible','setClickThrough','beginPetDrag','movePetDrag','endPetDrag','petMenu','captureCancel'];
const api = Object.fromEntries(methods.map(name => [name, (...args) => ipcRenderer.invoke(`komorebi:${name}`, ...args)]));
api.on = (name, fn) => {
  if (!['behavior','snapshot','draft','speech','pet-message','chat-open','chat-side','music','music-signal','music-audio','dance-stream','dance-stream-status'].includes(name)) throw new Error('Unknown event');
  const handler = (_event, value) => fn(value);
  ipcRenderer.on(`komorebi:${name}`, handler);
  return () => ipcRenderer.removeListener(`komorebi:${name}`, handler);
};
contextBridge.exposeInMainWorld('komorebi', api);
