import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputPath = resolve(projectRoot, process.argv[2] ?? "../YOL1_Presentacion_Finanzas_Identica_2026-08-25.html");
const serverOrigin = process.env.YOL1_EXPORT_ORIGIN ?? "http://localhost:3000";
const endpoints = ["enterprise", "b2c", "smb", "opex", "providers", "transversal", "actuals", "milestones", "audit"];

async function loadApiSnapshot() {
  const responses = await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const suffix = endpoint === "audit" ? "?limit=500" : "";
      const response = await fetch(`${serverOrigin}/api/${endpoint}${suffix}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status}`);
      return [endpoint, await response.json()] as const;
    } catch {
      return [endpoint, undefined] as const;
    }
  }));
  return Object.fromEntries(responses.filter((entry) => entry[1] !== undefined));
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const temporaryBuild = await mkdtemp(join(tmpdir(), "yol1-offline-"));
process.env.YOL1_OFFLINE_OUT_DIR = temporaryBuild;

try {
  const apiSnapshot = await loadApiSnapshot();
  await build({ configFile: resolve(projectRoot, "vite.offline.config.ts"), logLevel: "warn" });
  const builtFiles = await readdir(temporaryBuild);
  const scriptName = builtFiles.find((file) => file.endsWith(".js"));
  const styleName = builtFiles.find((file) => file.endsWith(".css"));
  if (!scriptName || !styleName) throw new Error("La compilación offline no produjo JavaScript y CSS.");

  const [script, styles, funnelLatin] = await Promise.all([
    readFile(join(temporaryBuild, scriptName), "utf8"),
    readFile(join(temporaryBuild, styleName), "utf8"),
    readFile(resolve(projectRoot, "dist/client/_next/static/_vinext_fonts/funnel-display-1de6628e8a73/funnel-display-bc869af7.woff2")),
  ]);
  const fontCss = `@font-face{font-family:'Funnel Display';font-style:normal;font-weight:300 800;font-display:swap;src:url(data:font/woff2;base64,${funnelLatin.toString("base64")}) format('woff2')} :root{--font-funnel:'Funnel Display';}`;
  const presentationCss = `.offline-presentation .topbar{position:sticky;top:0;z-index:20}.offline-presentation .sidebar{z-index:30}.offline-presentation .shell-page-title{scroll-margin-top:90px}@media print{.offline-presentation .sidebar,.offline-presentation .topbar,.offline-presentation .shell-actions,.offline-presentation .enterprise-toolbar{display:none!important}.offline-presentation .app-shell{display:block}.offline-presentation .content{max-width:none;padding:18px}.offline-presentation .panel,.offline-presentation .enterprise-kpis article{break-inside:avoid;box-shadow:none}}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Presentación autónoma del modelo financiero YOL1"><title>YOL1 Financial Planning · Presentación para Finanzas</title><style>${fontCss}${styles}${presentationCss}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.__YOL1_OFFLINE_API__=${safeJson(apiSnapshot)};</script><script>${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  await writeFile(outputPath, html, "utf8");
  console.log(outputPath);
} finally {
  await rm(temporaryBuild, { recursive: true, force: true });
}
