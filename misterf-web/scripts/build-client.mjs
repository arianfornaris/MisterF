import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(projectRoot, 'public', 'build', '.vite', 'manifest.json');
const chatScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'chat-client-script.ejs',
);
const stylesheetPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'app-stylesheet.ejs',
);
const sourceStylesheetPath = path.join(projectRoot, 'src', 'client', 'styles', 'app.css');
const buildCssDir = path.join(projectRoot, 'public', 'build', 'css');

function bundleStylesheet(filePath, seen = new Set()) {
  const normalizedPath = path.normalize(filePath);
  if (seen.has(normalizedPath)) {
    return '';
  }

  seen.add(normalizedPath);
  const source = fs.readFileSync(normalizedPath, 'utf8');

  return source.replace(
    /^@import\s+['"](.+?)['"];\s*$/gm,
    (_match, importPath) => {
      const resolvedImportPath = path.resolve(path.dirname(normalizedPath), importPath);
      return bundleStylesheet(resolvedImportPath, seen);
    },
  );
}

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
const chatScriptPartialContents = `    <script type="module" src="${scriptPath}"></script>\n`;

fs.writeFileSync(chatScriptPartialPath, chatScriptPartialContents, 'utf8');

const stylesheetContents = bundleStylesheet(sourceStylesheetPath);
const stylesheetHash = crypto
  .createHash('sha256')
  .update(stylesheetContents)
  .digest('hex')
  .slice(0, 8);
const hashedStylesheetFileName = `app-${stylesheetHash}.css`;
const hashedStylesheetFilePath = path.join(buildCssDir, hashedStylesheetFileName);
const stylesheetPath = `/public/build/css/${hashedStylesheetFileName}`;

fs.mkdirSync(buildCssDir, { recursive: true });
for (const fileName of fs.readdirSync(buildCssDir)) {
  if (
    (fileName === 'app.css' || /^app-[a-f0-9]{8}\.css$/.test(fileName)) &&
    fileName !== hashedStylesheetFileName
  ) {
    fs.rmSync(path.join(buildCssDir, fileName));
  }
}
fs.writeFileSync(hashedStylesheetFilePath, stylesheetContents);
fs.writeFileSync(
  stylesheetPartialPath,
  `    <link rel="stylesheet" href="${stylesheetPath}">\n`,
  'utf8',
);

console.log(
  `Generated ${path.relative(projectRoot, chatScriptPartialPath)} -> ${scriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, stylesheetPartialPath)} -> ${stylesheetPath}`,
);
