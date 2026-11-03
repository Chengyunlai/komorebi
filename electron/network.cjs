const { execFileSync } = require('node:child_process');

function proxyEnvironment(text, existing = {}) {
  const values = Object.fromEntries(text.split('\n').map(line => line.match(/^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/)).filter(Boolean).map(match => [match[1],match[2]]));
  const result = { ...existing };
  for (const [prefix, variable] of [['HTTP','HTTP_PROXY'],['HTTPS','HTTPS_PROXY']]) {
    if (existing[variable] || existing[variable.toLowerCase()]) continue;
    const host = values[`${prefix}Proxy`], port = Number(values[`${prefix}Port`]);
    if (values[`${prefix}Enable`] === '1' && /^[\w.:[\]-]+$/.test(host || '') && port > 0 && port < 65536) {
      result[variable] = `http://${host}:${port}`;
    }
  }
  if (result.HTTP_PROXY || result.HTTPS_PROXY) result.NO_PROXY ||= 'localhost,127.0.0.1,::1';
  return result;
}
function systemProxyEnvironment(existing = process.env) {
  if (process.platform !== 'darwin') return existing;
  try { return proxyEnvironment(execFileSync('/usr/sbin/scutil',['--proxy'],{encoding:'utf8',timeout:3000}),existing); }
  catch { return existing; }
}
module.exports = { proxyEnvironment, systemProxyEnvironment };
