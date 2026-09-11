// Renderer-level checks: every screen must render and link to registered routes.
// Browser verification is separate; this script does not emulate a browser.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const scope = vm.createContext({
  location: { hash: "#learn/home", href: "http://127.0.0.1:4173/#learn/home" },
  URLSearchParams,
  document: { querySelector: () => ({ addEventListener() {} }) },
  window: { addEventListener() {} },
});
for (const file of [
  "resource-pages.js",
  "media-pages.js",
  "account-pages.js",
  "pages.js",
  "demo.js",
]) {
  let source = fs.readFileSync(path.join(directory, file), "utf8");
  if (file === "demo.js") source = source.replace(/render\(\);\s*$/, "");
  vm.runInContext(source, scope, { filename: file });
}
const routes = vm.runInContext("Object.keys(renderers)", scope);
let checked = 0;
for (const activeMode of ["learn", "teach"])
  for (const route of routes) {
    const html = vm.runInContext(
      `mode=${JSON.stringify(activeMode)};page=${JSON.stringify(route)};location.hash='#'+mode+'/'+page;renderers[page]();`,
      scope,
    );
    const headingCount = [...html.matchAll(/<h1[\s>]/g)].length;
    if (headingCount !== 1)
      throw new Error(`${activeMode}/${route}: ${headingCount} h1 headings`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    if (new Set(ids).size !== ids.length)
      throw new Error(`${route}: duplicate element IDs`);
    for (const [, target] of html.matchAll(
      /href="#(?:learn|teach)\/([^"?]+)(?:\?[^\"]*)?"/g,
    )) {
      if (!routes.includes(target))
        throw new Error(`${route}: unregistered target ${target}`);
    }
    for (const [, asset] of html.matchAll(
      /(?:src|href)="(assets\/[^"?#]+)"/g,
    )) {
      if (!fs.existsSync(path.join(directory, asset)))
        throw new Error(`${route}: missing ${asset}`);
    }
    checked++;
  }
console.log(
  `${routes.length} screens; ${checked} mode/screen renders passed. Headings, IDs, internal routes, and local assets checked.`,
);
const viewsDirectory = path.resolve(directory, "../../misterf-web/views");
const views = fs
  .readdirSync(viewsDirectory)
  .filter((name) => name.endsWith(".ejs"));
const coverage = fs.readFileSync(path.join(directory, "PAGE-MAP.md"), "utf8");
for (const view of views) {
  if (!coverage.includes("`" + view + "`"))
    throw new Error(`View missing from PAGE-MAP.md: ${view}`);
}
console.log(`${views.length} top-level EJS views represented in PAGE-MAP.md.`);
