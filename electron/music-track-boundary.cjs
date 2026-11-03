// Song IDs may arrive later with lyrics. Metadata enrichment is not a new song.
function createMusicTrackBoundary(){
 let previous='';
 return state=>{
  if(!state?.title||state.preview)return false;
  const key=JSON.stringify([state.source,state.title,state.artist||'',state.album||'']);
  const changed=Boolean(previous&&key!==previous);previous=key;return changed;
 };
}
module.exports={createMusicTrackBoundary};
