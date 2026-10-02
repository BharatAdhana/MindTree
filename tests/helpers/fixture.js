const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
async function fixture(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mindtree-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
  return root;
}
module.exports = { fixture };
