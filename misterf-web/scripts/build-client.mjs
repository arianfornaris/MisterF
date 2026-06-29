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
const practiceGuidesScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'practice-guides-client-script.ejs',
);
const resourcesScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'resources-client-script.ejs',
);
const roleplaysScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'roleplays-client-script.ejs',
);
const assignmentsScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'assignments-client-script.ejs',
);
const clientErrorTelemetryScriptPartialPath = path.join(
  projectRoot,
  'views',
  'partials',
  'client-error-telemetry-script.ejs',
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
const assignmentsEntry = manifest['src/client/assignments/index.js'];
const chatEntry = manifest['src/client/chat/index.js'];
const clientErrorTelemetryEntry = manifest['src/client/telemetry/clientErrorReporter.js'];
const practiceGuidesEntry = manifest['src/client/practiceGuides/index.js'];
const resourcesEntry = manifest['src/client/resources/index.js'];
const roleplaysEntry = manifest['src/client/roleplays/index.js'];

if (!assignmentsEntry?.file) {
  console.error('Could not find assignments entry in Vite manifest.');
  process.exit(1);
}
if (!chatEntry?.file) {
  console.error('Could not find chat entry in Vite manifest.');
  process.exit(1);
}
if (!clientErrorTelemetryEntry?.file) {
  console.error('Could not find client error telemetry entry in Vite manifest.');
  process.exit(1);
}
if (!practiceGuidesEntry?.file) {
  console.error('Could not find practice guides entry in Vite manifest.');
  process.exit(1);
}
if (!resourcesEntry?.file) {
  console.error('Could not find resources entry in Vite manifest.');
  process.exit(1);
}
if (!roleplaysEntry?.file) {
  console.error('Could not find roleplays entry in Vite manifest.');
  process.exit(1);
}

const assignmentsScriptPath = `/public/build/${assignmentsEntry.file}`;
const chatScriptPath = `/public/build/${chatEntry.file}`;
const clientErrorTelemetryScriptPath = `/public/build/${clientErrorTelemetryEntry.file}`;
const practiceGuidesScriptPath = `/public/build/${practiceGuidesEntry.file}`;
const resourcesScriptPath = `/public/build/${resourcesEntry.file}`;
const roleplaysScriptPath = `/public/build/${roleplaysEntry.file}`;

fs.writeFileSync(
  assignmentsScriptPartialPath,
  `    <script type="module" src="${assignmentsScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  chatScriptPartialPath,
  `    <script type="module" src="${chatScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  clientErrorTelemetryScriptPartialPath,
  `    <script type="module" src="${clientErrorTelemetryScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  practiceGuidesScriptPartialPath,
  `    <script type="module" src="${practiceGuidesScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  resourcesScriptPartialPath,
  `    <script type="module" src="${resourcesScriptPath}"></script>\n`,
  'utf8',
);
fs.writeFileSync(
  roleplaysScriptPartialPath,
  `    <script type="module" src="${roleplaysScriptPath}"></script>\n`,
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
  `Generated ${path.relative(projectRoot, assignmentsScriptPartialPath)} -> ${assignmentsScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, chatScriptPartialPath)} -> ${chatScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, clientErrorTelemetryScriptPartialPath)} -> ${clientErrorTelemetryScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, practiceGuidesScriptPartialPath)} -> ${practiceGuidesScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, resourcesScriptPartialPath)} -> ${resourcesScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, roleplaysScriptPartialPath)} -> ${roleplaysScriptPath}`,
);
console.log(
  `Generated ${path.relative(projectRoot, stylesheetPartialPath)} -> ${stylesheetPath}`,
);
