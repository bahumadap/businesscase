import type { B2CPlan } from "../b2c/types";
import type { EnterprisePlan } from "../enterprise/types";
import type { Milestone } from "../milestones/types";
import type { SmbPlan } from "../smb/types";

export type ProductVertical = "Enterprise" | "B2C" | "SMB";

export type CatalogProduct = {
  key: string;
  productId: string;
  name: string;
  vertical: ProductVertical;
  goLiveMonth: string;
  status: "Activo" | "Planificado" | "Por validar";
  detail: string;
};

export function buildProductCatalog(enterprise: EnterprisePlan, b2c: B2CPlan, smb: SmbPlan): CatalogProduct[] {
  const enterpriseProducts = enterprise.products.map<CatalogProduct>((product) => {
    const clients = enterprise.clients.filter((client) => client.productId === product.id);
    const clientIds = new Set(clients.map((client) => client.id));
    const pending = enterprise.volumeSegments.some((segment) => clientIds.has(segment.clientId) && (segment.volume === null || segment.status === "Por validar"));
    return {
      key: `enterprise:${product.id}`,
      productId: product.id,
      name: product.name,
      vertical: "Enterprise",
      goLiveMonth: clients.map((client) => client.goLiveMonth).sort()[0] ?? enterprise.modelStartMonth,
      status: pending ? "Por validar" : clients.length ? "Planificado" : "Por validar",
      detail: `${clients.length} cliente${clients.length === 1 ? "" : "s"} · driver ${product.driver}`,
    };
  });

  const b2cProducts = b2c.products.map<CatalogProduct>((product) => ({
    key: `b2c:${product.id}`,
    productId: product.id,
    name: product.segment === product.line ? product.line : `${product.line} · ${product.segment}`,
    vertical: "B2C",
    goLiveMonth: product.goLiveMonth,
    status: product.providerStatus === "Por validar" ? "Por validar" : product.active ? "Activo" : "Planificado",
    detail: `${product.provider} · ${product.active ? "ON" : "OFF"}`,
  }));

  const smbProducts = smb.products.map<CatalogProduct>((product) => ({
    key: `smb:${product.id}`,
    productId: product.id,
    name: product.name,
    vertical: "SMB",
    goLiveMonth: product.goLiveMonth,
    status: product.sourceStatus === "Fuente" ? "Activo" : "Por validar",
    detail: product.category,
  }));

  return [...enterpriseProducts, ...b2cProducts, ...smbProducts];
}

export function reconcileMilestonesWithCatalog(milestones: Milestone[], catalog: CatalogProduct[]) {
  const linked = milestones.map((milestone) => {
    if (milestone.productKey) {
      const product = catalog.find((item) => item.key === milestone.productKey);
      if (product) return { ...milestone, product: product.name, area: product.vertical };
    }
    const match = catalog.find((product) => product.vertical === milestone.area && (product.name === milestone.product || product.name.startsWith(`${milestone.product} ·`) || milestone.product.startsWith(`${product.name} ·`)));
    return match ? { ...milestone, productKey: match.key, product: match.name } : milestone;
  });

  const covered = new Set(linked.map((milestone) => milestone.productKey).filter(Boolean));
  const missing = catalog.filter((product) => !covered.has(product.key)).map<Milestone>((product) => {
    const date = `${product.goLiveMonth}-01`;
    return {
      id: `catalog-${product.key.replace(":", "-")}`,
      name: `Go Live ${product.name}`,
      area: product.vertical,
      country: "Chile",
      client: "",
      productKey: product.key,
      product: product.name,
      owner: "Por asignar",
      startDate: date,
      endDate: date,
      targetDate: date,
      status: "Planificado",
      progress: 0,
      notes: "Hito sincronizado automáticamente desde el producto de la vertical.",
    };
  });
  return [...linked, ...missing];
}
