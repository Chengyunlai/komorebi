const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
const DEFAULT_MODEL = 'deepseek-v4-flash';
function validateLlmConfig(input = {}) {
  if (!['codex','volcengine'].includes(input.provider)) throw new Error('请选择有效的模型提供方。');
  const baseUrl = String(input.baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  const model = String(input.model || DEFAULT_MODEL).trim();
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'ark.cn-beijing.volces.com' || url.port || url.username || url.password || url.search || url.hash || !['/api/coding/v3','/api/v3'].includes(url.pathname)) {
    throw new Error('请使用火山方舟北京区域的 HTTPS 地址：/api/coding/v3 或 /api/v3。');
  }
  if (!/^[a-zA-Z0-9_.:/-]{1,160}$/.test(model)) throw new Error('模型名称格式无效。');
  return { provider: input.provider, baseUrl, model };
}
function providerInvocation(input = { provider: 'codex' }) {
  if (input.provider === 'codex') return { args: [], env: {} };
  const config = validateLlmConfig(input);
  if (typeof input.key !== 'string' || !input.key.trim()) throw new Error('先在设置中保存火山引擎 API Key。');
  const entries = {
    model: config.model,
    model_provider: 'volcengine',
    'model_providers.volcengine.name': 'Volcengine',
    'model_providers.volcengine.base_url': config.baseUrl,
    'model_providers.volcengine.env_key': 'HARNESS_LLM_API_KEY',
    'model_providers.volcengine.wire_api': 'responses',
    'model_providers.volcengine.requires_openai_auth': false,
    'model_providers.volcengine.supports_websockets': false,
    model_supports_reasoning_summaries: true,
    'shell_environment_policy.exclude': ['HARNESS_LLM_API_KEY']
  };
  return {
    args: Object.entries(entries).flatMap(([name,value]) => ['-c', `${name}=${JSON.stringify(value)}`]),
    env: { MOZI_LLM_PROVIDER: 'volcengine', HARNESS_LLM_BASE_URL: config.baseUrl, HARNESS_LLM_MODEL: config.model, HARNESS_LLM_API_KEY: input.key.trim() }
  };
}
module.exports = { DEFAULT_BASE_URL, DEFAULT_MODEL, validateLlmConfig, providerInvocation };
