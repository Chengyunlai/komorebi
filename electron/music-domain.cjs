const NETEASE_BUNDLE='com.netease.163music';
const finite=(value,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
function parseLrc(text) {
  if(typeof text!=='string')return [];
  const offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000;
  const entries=new Map();
  for(const line of text.slice(0,200000).split(/\r?\n/)){
    const stamps=[...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if(!stamps.length)continue;
    const words=line.replace(/\[[^\]]*\]/g,'').trim();if(!words)continue;
    for(const stamp of stamps){
      if(Number(stamp[2])>=60)continue;
      const time=Math.max(0,Number(stamp[1])*60+Number(stamp[2])+(stamp[3]?Number('0.'+stamp[3]):0)-offset);
      const key=Math.round(time*1000),old=entries.get(key)||[];
      if(!old.includes(words))old.push(words);entries.set(key,old);
    }
  }
  return [...entries].sort((a,b)=>a[0]-b[0]).slice(0,5000).map(([time,words])=>({time:time/1000,text:words.join(' / ')}));
}
function songIdentifier(payload) {
  for(const key of ['contentItemIdentifier','uniqueIdentifier']){
    const value=String(payload[key]||'');
    if(/^\d{1,13}$/.test(value)&&Number(value)>0)return value;
    const match=value.match(/(?:song\/|song\?id=|[?&]id=)(\d{1,13})(?:\D|$)/);
    if(match)return match[1];
  }
  return null;
}
function normalizePlayback(payload,now=Date.now()) {
  if(payload?.bundleIdentifier!==NETEASE_BUNDLE||typeof payload.title!=='string'||!payload.title.trim())return null;
  const playing=payload.playing===true;
  const rate=playing?Math.max(0,Math.min(4,finite(payload.playbackRate,1))):0;
  const duration=Math.max(0,finite(payload.duration));
  const timestamp=typeof payload.timestamp==='number'?payload.timestamp*1000:Date.parse(payload.timestamp);
  const elapsed=finite(payload.elapsedTime);
  const drift=Number.isFinite(timestamp)?Math.max(0,(now-timestamp)/1000)*rate:0;
  const position=typeof payload.elapsedTimeNow==='number'?payload.elapsedTimeNow:elapsed+drift;
  return {source:'netease',status:playing?'playing':'paused',title:payload.title.trim().slice(0,300),artist:String(payload.artist||'').slice(0,300),album:String(payload.album||'').slice(0,300),songId:songIdentifier(payload),duration,position:Math.max(0,duration?Math.min(duration,position):position),rate,observedAt:now};
}
function trackIdentity(track){return track?[track.songId||'',track.title,track.artist,track.album].join('\u0001'):'';}
function normalizeName(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');}
function matchSong(songs,track) {
  const title=normalizeName(track.title),artist=normalizeName(track.artist);
  if(!title||!artist)return {id:null,reason:'unmatched'};
  const matches=(Array.isArray(songs)?songs:[]).filter(song=>{
    if(normalizeName(song.name)!==title)return false;
    const artists=(song.artists||song.ar||[]).map(a=>normalizeName(a.name));
    if(!artists.includes(artist)&&artists.join('')!==artist)return false;
    const duration=Number(song.duration??song.dt)/1000;
    return !duration||!track.duration||Math.abs(duration-track.duration)<=Math.max(3,track.duration*.02);
  });
  const uniqueIds=list=>[...new Set(list.map(song=>String(song.id)).filter(id=>/^\d{1,13}$/.test(id)&&Number(id)>0))];
  const ids=uniqueIds(matches);
  if(ids.length===1)return {id:ids[0],reason:'matched'};
  // Reissues often have identical title, artist and duration. The album supplied
  // by Now Playing can disambiguate them without choosing an arbitrary result.
  const album=normalizeName(track.album);
  if(ids.length>1&&album){
    const albumIds=uniqueIds(matches.filter(song=>normalizeName((song.album||song.al)?.name)===album));
    if(albumIds.length===1)return {id:albumIds[0],reason:'matched'};
  }
  return {id:null,reason:ids.length>1?'ambiguous':'unmatched'};
}
function selectSong(songs,track){return matchSong(songs,track).id;}
class PlaybackDecoder {
  constructor(){this.payload={};}
  decode(line,now=Date.now()){
    const event=JSON.parse(line);
    if(event.type!=='data'||!event.payload||typeof event.payload!=='object'||Array.isArray(event.payload))throw new Error('无效音乐状态。');
    if(!event.diff)this.payload={};
    for(const [key,value] of Object.entries(event.payload))value===null?delete this.payload[key]:this.payload[key]=value;
    return normalizePlayback(this.payload,now);
  }
}
module.exports={NETEASE_BUNDLE,parseLrc,songIdentifier,normalizePlayback,trackIdentity,matchSong,selectSong,PlaybackDecoder};
