/** Coalesce feature packets without replacing an onset's strength with later flux.
 * This host adapter preserves observations; it does not infer musical beats.
 */
export function createMusicSignalDelivery() {
 let stream, onset=null
 return events=>{
  let feature=null
  for(const event of events){
   if(event.streamId!==stream){stream=event.streamId;onset=null}
   if(event.type==='onset')onset=event
   if(event.type==='features')feature={...event,lastOnsetStrength:onset?.sampleFrame===event.lastOnsetFrame?onset.strength:0}
  }
  return feature
 }
}
