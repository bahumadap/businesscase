import { TRANSVERSAL_SEED } from "../src/transversal/seed";

const origin = process.env.YOL1_APP_ORIGIN ?? "http://localhost:3000";
const response = await fetch(`${origin}/api/transversal`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(TRANSVERSAL_SEED),
});

if (!response.ok) {
  throw new Error(`No fue posible persistir Transversal: ${response.status} ${await response.text()}`);
}

console.log(await response.text());
