import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname);
const buildDir = path.join(projectRoot, 'public', 'build');
const manifestPath = path.join(projectRoot, 'public', 'build', '.vite', 'manifest.json');
const chatScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'chat-client-script.ejs',
);
const chatroomsScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'chatrooms-client-script.ejs',
);
const practiceModulesScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'practice-modules-client-script.ejs',
);
const stylesheetPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'app-stylesheet.ejs',
);
const sourceStylesheetPath = path.join(projectRoot, 'src', 'client', 'styles', 'app.css');
const buildCssDir = path.join(projectRoot, 'public', 'build', 'css');

function cleanGeneratedClientBuildArtifacts() {
  fs.mkdirSync(buildDir, { recursive: true });

  for (const directoryName of ['.vite', 'assets', 'chunks', 'entries']) {
    fs.rmSync(path.join(buildDir, directoryName), {
      force: true,
      recursive: true,
    });
  }

  for (const fileName of fs.readdirSync(buildDir)) {
    const filePath = path.join(buildDir, fileName);
    if (!fs.statSync(filePath).isFile()) {
      continue;
    }

    if (/\.js(?:\.map)?$/.test(fileName)) {
      fs.rmSync(filePath);
    }
  }
}

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

cleanGeneratedClientBuildArtifacts();

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
const chatroomsEntry = manifest['src/client/chatrooms/main.js'];
const practiceModulesEntry = manifest['src/client/practiceModules/index.js'];

if (!chatEntry?.file) {
  console.error('Could not find chat entry in Vite manifest.');
  process.exit(1);
}
if (!chatroomsEntry?.file) {
  console.error('Could not find chatrooms entry in Vite manifest.');
  process.exit(1);
}
if (!practiceModulesEntry?.file) {
  console.error('Could not find practice modules entry in Vite manifest.');
  process.exit(1);
}

const chatScriptPath = `/public/build/${chatEntry.file}`;
const chatroomsScriptPath = `/public/build/${chatroomsEntry.file}`;
const practiceModulesScriptPath = `/public/build/${practiceModulesEntry.file}`;

fs.writeFileSync(
  chatScriptPartialPath,
  `    <script type="module" src="${chatScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  chatroomsScriptPartialPath,
  `    <script type="module" src="${chatroomsScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  practiceModulesScriptPartialPath,
  `    <script type="module" src="${practiceModulesScriptPath}"></script>\n`,
  'utf8',
);

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
  `Generated ${path.relative(projectRoot, chatScriptPartialPath)} -> ${chatScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, chatroomsScriptPartialPath)} -> ${chatroomsScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, practiceModulesScriptPartialPath)} -> ${practiceModulesScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, stylesheetPartialPath)} -> ${stylesheetPath}`,
);
