// This gate selects requests worth classifying; only Laya chooses an action.
async function routeSubmission(input,{decide,startTask}){
 const text=String(input?.instruction||'').trim();
 if(!input.context&&!input.attachment&&text.length<=120&&/舞|跳|活泼|轻轻|动作|别动|安静待/.test(text)){
  const decision=await decide(text);
  if(decision.accepted)return {kind:'behavior',...decision};
 }
 return startTask(input);
}
module.exports={routeSubmission};
