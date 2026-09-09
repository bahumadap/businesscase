import assert from "node:assert/strict";
import test from "node:test";
import { B2C_SEED } from "../src/b2c/seed";
import { buildProductCatalog, reconcileMilestonesWithCatalog } from "../src/catalog/products";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import { MILESTONES_SEED } from "../src/milestones/seed";
import { SMB_SEED } from "../src/smb/seed";

test("el catálogo contiene exactamente los productos de las tres verticales", () => {
  const catalog = buildProductCatalog(ENTERPRISE_SEED, B2C_SEED, SMB_SEED);
  assert.equal(catalog.length, ENTERPRISE_SEED.products.length + B2C_SEED.products.length + SMB_SEED.products.length);
  assert.equal(new Set(catalog.map((product) => product.key)).size, catalog.length);
  assert.deepEqual(new Set(catalog.map((product) => product.vertical)), new Set(["Enterprise", "B2C", "SMB"]));
});

test("roadmap incorpora cada producto una sola vez sin borrar hitos existentes", () => {
  const catalog = buildProductCatalog(ENTERPRISE_SEED, B2C_SEED, SMB_SEED);
  const reconciled = reconcileMilestonesWithCatalog(structuredClone(MILESTONES_SEED.milestones), catalog);
  const covered = new Set(reconciled.map((milestone) => milestone.productKey).filter(Boolean));
  assert.equal(covered.size, catalog.length);
  assert.ok(MILESTONES_SEED.milestones.every((milestone) => reconciled.some((row) => row.id === milestone.id)));
  assert.equal(reconcileMilestonesWithCatalog(reconciled, catalog).length, reconciled.length);
});
