"use client";

const costDestinations = [
  { title: "Enterprise", href: "/enterprise", type: "Costos directos", detail: "Costos propios de productos y clientes Enterprise." },
  { title: "B2C", href: "/b2c", type: "Costos directos", detail: "Costo de adquisición, proveedores y unit economics B2C." },
  { title: "SMB", href: "/smb", type: "Costos directos", detail: "Costo financiero, operacional y comercial del modelo PyME." },
  { title: "OPEX corporativo", href: "/opex", type: "Gasto transversal", detail: "Personas, tecnología, marketing y administración común de YOL1." },
];

export function CostsManager() {
  return (
    <>
      <div className="page-heading"><div><span className="section-kicker">MAPA DE COSTOS</span><h2>Una fuente para cada costo</h2><p>La carga genérica fue retirada para evitar duplicidades. Usa la vertical para costos directos y OPEX para gastos corporativos.</p></div></div>
      <section className="entity-grid">
        {costDestinations.map((destination, index) => <article className="entity-card" key={destination.title}>
          <div className="entity-card-head"><span>C{String(index + 1).padStart(2, "0")}</span></div>
          <h3>{destination.title}</h3><p>{destination.detail}</p>
          <dl><div><dt>Clasificación</dt><dd>{destination.type}</dd></div></dl>
          <a href={destination.href}>Abrir fuente <span>→</span></a>
        </article>)}
      </section>
    </>
  );
}
