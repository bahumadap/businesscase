import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the YOL1 executive dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>YOL1 Financial Planning<\/title>/i);
  assert.match(html, /Executive Dashboard/);
  assert.match(html, /Modelo conectado/);
  assert.match(html, /Escenario base/);
  assert.match(html, /Revenue consolidado/);
  assert.match(html, /Ingresos vs\. costos totales/);
  assert.match(html, /Aporte por vertical/);
  assert.match(html, /property="og:image" content="http:\/\/localhost:3000\/og.png"/);
  assert.doesNotMatch(html, /href="\/(?:verticals|products|costs|assumptions|scenarios)"/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("server-renders every planning section", async () => {
  const routes = [
    ["/verticals", "Verticales de negocio"],
    ["/products", "Productos"],
    ["/roadmap", "Pipeline en el tiempo"],
    ["/costs", "Una fuente para cada costo"],
    ["/assumptions", "Biblioteca de supuestos"],
    ["/scenarios", "Base, Upside y Downside"],
    ["/imports", "Descarga, edita y vuelve a cargar"],
    ["/providers", "Proveedores"],
    ["/actuals", "Presupuesto vs. Real"],
    ["/audit", "Log de auditoría"],
    ["/enterprise", "Modelo Enterprise"],
    ["/b2c", "Modelo B2C"],
    ["/smb", "Modelo SMB"],
    ["/opex", "OPEX"],
    ["/consolidated", "Flujo de caja consolidado"],
    ["/transversal", "Economía transversal YOL1"],
    ["/inputs", "Centro de Inputs"],
  ];

  for (const [path, text] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(text), path);
  }
});

test("Escenario Real action links to the editable records", async () => {
  const response = await render("/actuals");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="#escenario-real"[^>]*>Escenario Real<\/a>/);
  assert.match(html, /id="escenario-real"/);
});
