import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(projectRoot, 'public', 'build', '.vite', 'manifest.json');
const partialPath = path.join(projectRoot, 'views', 'partials', 'chat-client-script.ejs');

const viteResult = spawnSync('npx', ['vite', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (viteResult.status !== 0) {
  process.exit(viteResult.status ?? 1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const chatEntry = manifest['src/client/chat/index.js'];

if (!chatEntry?.file) {
  console.error('Could not find chat entry in Vite manifest.');
  process.exit(1);
}

const scriptPath = `/public/build/${chatEntry.file}`;
const partialContents = `    <script type="module" src="${scriptPath}"></script>\n`;

fs.writeFileSync(partialPath, partialContents, 'utf8');
console.log(`Generated ${path.relative(projectRoot, partialPath)} -> ${scriptPath}`);
