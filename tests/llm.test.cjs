const {test}=require('node:test');
const assert=require('node:assert/strict');
const {providerInvocation,validateLlmConfig,DEFAULT_BASE_URL,DEFAULT_MODEL}=require('../electron/llm.cjs');
const {Store}=require('../electron/store.cjs');
test('火山配置保留精确模型名与 Coding Plan 路径，密钥只放环境',()=>{
 const key='fake-key-only-for-offline-test';
 const invocation=providerInvocation({provider:'volcengine',baseUrl:DEFAULT_BASE_URL+'/',model:DEFAULT_MODEL,key});
 assert.equal(invocation.env.HARNESS_LLM_API_KEY,key);
 assert.equal(invocation.env.HARNESS_LLM_MODEL,'deepseek-v4-flash');
 assert.equal(invocation.env.HARNESS_LLM_BASE_URL,DEFAULT_BASE_URL);
 assert(!JSON.stringify(invocation.args).includes(key));
 assert(invocation.args.includes('model_providers.volcengine.wire_api="responses"'));
 assert(invocation.args.includes('model_providers.volcengine.requires_openai_auth=false'));
 assert(invocation.args.includes('shell_environment_policy.exclude=["HARNESS_LLM_API_KEY"]'));
});
test('火山配置失败不回退到其他提供方，拒绝错误地址',()=>{
 assert.throws(()=>providerInvocation({provider:'volcengine',baseUrl:DEFAULT_BASE_URL,model:DEFAULT_MODEL}),/Key/);
 assert.throws(()=>validateLlmConfig({provider:'volcengine',baseUrl:'https://example.com/api/coding/v3',model:DEFAULT_MODEL}),/方舟/);
 assert.throws(()=>validateLlmConfig({provider:'volcengine',baseUrl:'http://ark.cn-beijing.volces.com/api/coding/v3',model:DEFAULT_MODEL}),/HTTPS/);
 assert.deepEqual(providerInvocation({provider:'codex'}),{args:[],env:{}});
});
test('渲染器快照只获得密钥存在状态，不获得密文',()=>{
 const store=new Store(':memory:');
 try {
  store.setSetting('llmKey','fake-ciphertext-for-test');store.setSetting('llmProvider','volcengine');
  const snapshot=store.snapshot();assert.equal(snapshot.settings.hasLlmKey,true);
  assert(!JSON.stringify(snapshot).includes('fake-ciphertext-for-test'));
 }finally{store.close();}
});
