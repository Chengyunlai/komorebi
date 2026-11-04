/** Suspend all app surfaces for a capture without changing saved visibility. */
function createCaptureVisibility({windows, canRestore=()=>true}) {
 let pending=0, snapshot=[];
 return {
  get active(){return pending>0},
  acquire(){
   if(pending++===0)snapshot=windows().filter(window=>window&&!window.isDestroyed()&&window.isVisible());
   for(const window of windows())if(window&&!window.isDestroyed())window.hide();
   let released=false;
   return ()=>{
    if(released)return;released=true;
    if(--pending>0)return;
    const restore=snapshot;snapshot=[];
    for(const window of restore)if(!window.isDestroyed()&&canRestore(window))window.showInactive();
   };
  }
 };
}
module.exports={createCaptureVisibility};
