import { PlanningShell } from "../../src/components/PlanningShell";

const groups = [
  { title: "Volumen", description: "TPV, transacciones, usuarios, clientes y cuentas.", items: ["TPV mensual", "Transacciones", "Usuarios activos"] },
  { title: "Pricing", description: "Spread, fee por transacción, take rate y fee mensual.", items: ["Spread FX", "Fee / tx", "Take rate"] },
  { title: "Costos directos", description: "Proveedores, rails, KYC y costos variables.", items: ["Costo / tx", "Costo proveedor", "Costo KYC"] },
  { title: "Growth", description: "Curvas relativas al Go Live y crecimiento operativo.", items: ["Nuevos clientes", "Ramp-up", "Churn"] },
];

export default function AssumptionsPage() {
  return <PlanningShell active="Supuestos" eyebrow="DRIVERS DEL MODELO" title="Supuestos" actionLabel="+ Nuevo supuesto"><div className="page-heading"><div><span className="section-kicker">INPUTS EDITABLES</span><h2>Biblioteca de supuestos</h2><p>Los resultados se calculan desde drivers trazables, no desde revenue agregado.</p></div></div><section className="assumption-grid">{groups.map((group) => <article className="panel assumption-card" key={group.title}><span className="assumption-icon">{group.title.slice(0, 1)}</span><h3>{group.title}</h3><p>{group.description}</p><ul>{group.items.map((item) => <li key={item}><span>{item}</span><button>Configurar →</button></li>)}</ul></article>)}</section><article className="panel fx-panel"><div><span className="section-kicker">MONEDA ÚNICA DE REPORTE · USD</span><h2>FX corporativo centralizado</h2><p>Enterprise, B2C, OPEX y Consolidado usan el mismo supuesto CLP/USD.</p></div><a className="method-chip" href="/enterprise">Editar FX en Enterprise →</a></article></PlanningShell>;
}
