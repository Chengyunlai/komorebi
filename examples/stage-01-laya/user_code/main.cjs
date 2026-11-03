const {BehaviorDirector}=require('../../../electron/behavior.cjs');
const director=new BehaviorDirector();
(async()=>{
 try{
  for(const text of process.argv.slice(2).length?process.argv.slice(2):['轻轻跳','活泼一点','停止跳舞','帮我解释这段代码']){
   const result=await director.decide(text);console.log(JSON.stringify({text,...result}));
  }
 }finally{director.stop();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
