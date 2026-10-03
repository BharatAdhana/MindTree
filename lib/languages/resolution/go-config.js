'use strict';
function parseGoConfig(text) {
  const config = { module: null, use: [], replace: [], require: new Map() };
  let block;
  const tokens = value => (value.match(/"(?:\\.|[^"\\])*"|`[^`]*`|[^\s]+/g) || []).map(t => t.replace(/^["`]|["`]$/g, ''));
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/\s+\/\/.*$/, '').trim();
    if (!line || line.startsWith('//')) continue;
    if (line === ')') { block = null; continue; }
    const header = /^(module|use|replace|require)\s+(.*)$/.exec(line);
    const directive = header?.[1] || block, rest = header?.[2] || line;
    if (rest === '(') { block = directive; continue; }
    const words = tokens(rest);
    if (directive === 'module') config.module = words[0];
    if (directive === 'use') config.use.push(words[0]);
    if (directive === 'require') config.require.set(words[0], words[1]);
    if (directive === 'replace') {
      const arrow = words.indexOf('=>');
      if (arrow > 0 && words[arrow + 1]) config.replace.push({ from: words[0], version: arrow > 1 ? words[1] : null, to: words[arrow + 1], replacementVersion: words[arrow + 2] });
    }
  }
  return config;
}
module.exports = { parseGoConfig };
