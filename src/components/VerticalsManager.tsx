"use client";

import { useEffect, useState } from "react";
import { buildProductCatalog, type CatalogProduct, type ProductVertical } from "../catalog/products";

const verticals: { name: ProductVertical; href: string; owner: string; description: string; color: string }[] = [
  { name: "Enterprise", href: "/enterprise", owner: "Equipo Enterprise", description: "Clientes corporativos, productos, curvas de volumen y costos directos.", color: "#173f42" },
  { name: "B2C", href: "/b2c", owner: "Equipo B2C", description: "Productos de personas, adquisición, cohortes y unit economics.", color: "#ca633c" },
  { name: "SMB", href: "/smb", owner: "Equipo SMB", description: "Factor, servicios comerciales, SGR y supuestos del modelo PyME.", color: "#4f7472" },
];

export function VerticalsManager() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/enterprise"), fetch("/api/b2c"), fetch("/api/smb")])
      .then(async ([enterprise, b2c, smb]) => {
        const enterpriseData = await enterprise.json();
        const b2cData = await b2c.json();
        const smbData = await smb.json();
        setProducts(buildProductCatalog(enterpriseData.plan, b2cData.plan, smbData.plan));
      })
      .catch(() => setProducts([]));
  }, []);

  return (
    <>
      <div className="page-heading"><div><span className="section-kicker">ESTRUCTURA COMERCIAL</span><h2>Verticales de negocio</h2><p>Cada vertical es dueña de sus productos, ingresos, drivers y costos directos.</p></div></div>
      <section className="entity-grid">
        {verticals.map((vertical, index) => <article className="entity-card" key={vertical.name}>
          <div className="entity-color" style={{ background: vertical.color }}></div>
          <div className="entity-card-head"><span>V{String(index + 1).padStart(2, "0")}</span></div>
          <h3>{vertical.name}</h3><p>{vertical.description}</p>
          <dl><div><dt>Responsable</dt><dd>{vertical.owner}</dd></div><div><dt>Productos</dt><dd>{products.filter((product) => product.vertical === vertical.name).length}</dd></div></dl>
          <a href={vertical.href}>Abrir modelo <span>→</span></a>
        </article>)}
      </section>
    </>
  );
}
