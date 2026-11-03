const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { Store } = require('../electron/store.cjs');
const { TaskRunner, retrieveNotes } = require('../electron/runner.cjs');
const { proxyEnvironment } = require('../electron/network.cjs');
test('CLI 遵循已启用的系统代理，保留显式环境覆盖',()=>{
  const raw=`<dictionary> {\n HTTPEnable : 1\n HTTPPort : 7897\n HTTPProxy : 127.0.0.1\n HTTPSEnable : 1\n HTTPSPort : 7897\n HTTPSProxy : 127.0.0.1\n}`;
  assert.equal(proxyEnvironment(raw).HTTPS_PROXY,'http://127.0.0.1:7897');
  assert.equal(proxyEnvironment(raw,{HTTPS_PROXY:'http://chosen.local:9000'}).HTTPS_PROXY,'http://chosen.local:9000');
  assert.equal(proxyEnvironment(raw.replace('HTTPSEnable : 1','HTTPSEnable : 0')).HTTPS_PROXY,undefined);
});
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'komorebi-test-'));
  const filename=path.join(dir,'test.sqlite');
  const store=new Store(filename);
  t.after(()=>{try{store.close()}catch{}fs.rmSync(dir,{recursive:true,force:true})});
  return {store,dir,filename};
}
test('项目隔离、结论纠错与中文搜索在重启后仍成立',t=>{
  const {store,filename,dir}=fixture(t);
  const a=store.addProject('项目甲',dir),b=store.addProject('项目乙',path.join(dir,'b'));
  const task=store.createTask({projectId:a.id,instruction:'分析数据库问题',context:''});
  assert.throws(()=>store.saveNote({projectId:a.id,taskId:task.id,title:'数据库',content:'未完成的猜测'}),/完成/);
  store.updateTask(task.id,{status:'completed',result:'使用 SQLite'});
  assert.throws(()=>store.saveNote({projectId:b.id,taskId:task.id,title:'数据库',content:'串项目'}),/同一个项目/);
  const n=store.saveNote({projectId:a.id,taskId:task.id,title:'数据库选择',content:'使用 SQLite。保留 100% 原始数据。'});
  store.saveNote({id:n.id,projectId:a.id,title:'数据库选择',content:'更正：仅保存用户确认的结论，100% 可导出。'});
  assert.equal(store.notes(b.id,'数据库').length,0);
  assert.equal(store.notes(a.id,'%').length,1);
  assert.equal(store.notes(a.id,'_').length,0);
  assert.throws(()=>store.saveNote({id:n.id,projectId:b.id,title:'错误',content:'修改其他项目'}),/不属于/);
  store.close();
  const restored=new Store(filename);
  assert.match(restored.notes(a.id,'更正')[0].content,/用户确认/);
  restored.close();
});
test('重启把未完成任务标为中断，不能伪装完成',t=>{
  const {store,filename,dir}=fixture(t);
  const p=store.addProject('甲',dir);
  const task=store.createTask({projectId:p.id,instruction:'分析',context:''});
  store.updateTask(task.id,{status:'running'});store.close();
  const reopened=new Store(filename);
  assert.equal(reopened.task(task.id).status,'failed');
  assert.match(reopened.task(task.id).error,/中断|退出/);reopened.close();
});
test('检索能找回中文相关结论，不注入无关记录',()=>{
  const notes=[{title:'数据库选型',content:'本项目采用 SQLite，支持离线使用。'},{title:'角色模型',content:'渲染使用 Pixi。'}];
  assert.equal(retrieveNotes(notes,'为什么选择这个数据库？')[0].title,'数据库选型');
  assert.equal(retrieveNotes(notes,'完全无关的天气').length,0);
});
test('真实子进程的分片 JSON 输出可以得到终态',async t=>{
  const {store,dir}=fixture(t);const p=store.addProject('甲',dir);
  const runner=new TaskRunner(store,{spawnProcess:(_bin,args,options)=>{
    assert.equal(args[args.indexOf('--sandbox')+1],'read-only');
    return spawn(process.execPath,['-e',`process.stdin.resume();process.stdin.on('end',()=>{const s=JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'真实夹具结果'}})+'\\n';process.stdout.write(s.slice(0,12));setTimeout(()=>{process.stdout.write(s.slice(12));process.exit(0)},30)});`],options);
  }});
  const done=once(runner,'settled');const task=runner.start({projectId:p.id,instruction:'测试分片',context:''});
  await done;
  assert.equal(store.task(task.id).status,'completed');assert.equal(store.task(task.id).result,'真实夹具结果');
});
test('取消后的迟到输出与退出不会把任务改成成功',async t=>{
  const {store,dir}=fixture(t);const p=store.addProject('甲',dir);
  const runner=new TaskRunner(store,{spawnProcess:(_bin,_args,options)=>spawn(process.execPath,['-e',`process.stdin.resume();process.on('SIGTERM',()=>{});setTimeout(()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'迟到结果'}}));process.exit(0)},300);`],options)});
  const task=runner.start({projectId:p.id,instruction:'等待然后取消',context:''});
  assert.throws(()=>runner.start({projectId:p.id,instruction:'另一件事',context:''}),/上一件事/);
  runner.cancel(task.id);
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(store.task(task.id).status,'cancelled');assert.equal(store.task(task.id).result,'');
});
test('气泡默认自动收起，明确关闭后重启仍保留关闭', t => {
  const {store, filename}=fixture(t);
  assert.equal(store.snapshot().settings.dismissOnBlur, true);
  store.setSetting('dismissOnBlur', false);
  assert.equal(store.snapshot().settings.dismissOnBlur, false);
  store.close();
  const reopened=new Store(filename);
  assert.equal(reopened.snapshot().settings.dismissOnBlur, false);
  reopened.close();
});
