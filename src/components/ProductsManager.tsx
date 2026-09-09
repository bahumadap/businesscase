"use client";

import { useEffect, useState } from "react";
import { buildProductCatalog, type CatalogProduct, type ProductVertical } from "../catalog/products";

const verticalHref: Record<ProductVertical, string> = { Enterprise: "/enterprise", B2C: "/b2c", SMB: "/smb" };

export function ProductsManager() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/enterprise"), fetch("/api/b2c"), fetch("/api/smb")])
      .then(async ([enterprise, b2c, smb]) => {
        if (!enterprise.ok || !b2c.ok || !smb.ok) throw new Error("No fue posible cargar el catálogo");
        const enterpriseData = await enterprise.json();
        const b2cData = await b2c.json();
        const smbData = await smb.json();
        setProducts(buildProductCatalog(enterpriseData.plan, b2cData.plan, smbData.plan));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Error de carga"));
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">CATÁLOGO UNIFICADO</span>
          <h2>Productos por vertical</h2>
          <p>Esta vista queda como índice. Los productos, supuestos y costos directos se administran dentro de Enterprise, B2C o SMB.</p>
        </div>
      </div>
      {error && <div className="enterprise-warning">{error}</div>}
      <article className="panel data-panel">
        <div className="table-tools"><span>{products.length} productos conectados al Roadmap</span></div>
        <div className="table-wrap">
          <table className="planning-table">
            <thead><tr><th>Producto</th><th>Vertical</th><th>Go Live</th><th>Estado</th><th>Detalle</th><th></th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.key}>
              <td><strong>{product.name}</strong><small>{product.productId}</small></td>
              <td>{product.vertical}</td>
              <td>{product.goLiveMonth}</td>
              <td><span className={`status-pill ${product.status === "Por validar" ? "draft" : ""}`}>{product.status}</span></td>
              <td>{product.detail}</td>
              <td><a className="row-action" href={verticalHref[product.vertical]}>Abrir vertical →</a></td>
            </tr>)}</tbody>
          </table>
        </div>
      </article>
    </>
  );
}
