const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'documents.json');
function read() { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; }
function register(document) {
  const entries = read();
  entries[document.id] = document;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(entries), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}
function get(id) { return read()[id]; }
function sourceNames(sources, threadId) {
  const entries = Object.values(read()).filter(d => d.threadId === threadId);
  return [...new Set(sources.filter(s => typeof s === 'string').map(source => {
    const name = path.basename(source.replace(/\\/g, '/'));
    return entries.find(d => d.internalName === name || d.id === source)?.name || name;
  }))];
}
module.exports = { register, get, sourceNames };
