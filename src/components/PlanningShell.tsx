import type { ReactNode } from "react";

const navigation: { label: string; icon: string; href: string; badge?: string }[] = [
  { label: "Dashboard", icon: "⌁", href: "/" },
  { label: "Consolidado", icon: "Σ", href: "/consolidated" },
  { label: "Enterprise", icon: "E", href: "/enterprise" },
  { label: "B2C", icon: "P", href: "/b2c" },
  { label: "SMB", icon: "S", href: "/smb" },
  { label: "Transversal", icon: "T", href: "/transversal" },
  { label: "OPEX", icon: "O", href: "/opex" },
  { label: "Centro de Inputs", icon: "#", href: "/inputs" },
  { label: "Presupuesto vs. Real", icon: "±", href: "/actuals" },
  { label: "Proveedores", icon: "⌘", href: "/providers" },
  { label: "Roadmap", icon: "↗", href: "/roadmap" },
  { label: "Importaciones", icon: "⇧", href: "/imports" },
  { label: "Auditoría", icon: "◎", href: "/audit" },
];

export function PlanningShell({
  active,
  eyebrow,
  title,
  children,
  actionLabel = "Editar supuestos",
  actionHref,
}: {
  active: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        {/* Vinext currently needs native anchors for cross-route navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="brand">
          {/* SVG local pequeño; se mantiene nativo por compatibilidad con Vinext. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/yol1-mark.svg" alt="" />
          <div><strong>YOL1</strong><span>FINANCIAL PLANNING</span></div>
        </a>
        <button className="company-switch" type="button">
          <span className="company-icon">Y1</span>
          <span><b>YOL1 Consolidado</b><small>Reporting · USD</small></span>
          <em>⌄</em>
        </button>
        <nav aria-label="Navegación principal">
          <p className="nav-label">PLANIFICACIÓN</p>
          {navigation.map((item) => (
            <a className={`nav-item ${active === item.label ? "active" : ""}`} href={item.href} key={item.label}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <small>{item.badge}</small>}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="demo-tag"><span className="live-dot"></span><p><b>Modelo conectado</b><small>Escenario base</small></p></div>
          <div className="profile"><div className="avatar">BA</div><p><strong>Benjamín Ahumada</strong><span>Administrador</span></p><button aria-label="Abrir menú de usuario" type="button">•••</button></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="global-search"><span aria-hidden="true">⌕</span><p>Buscar producto, vertical o supuesto…</p><kbd>⌘ K</kbd></div>
          <div className="header-right"><span className="system-ok"><i></i> Modelo actualizado</span><button className="icon-button" aria-label="Notificaciones">◌<i></i></button><div className="header-divider"></div><div className="header-scenario"><span>Escenario</span><strong>Base⌄</strong></div></div>
        </header>
        <div className="content">
          <div className="shell-page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><span>Planificación financiera y roadmap de productos · Escenario base</span></div><div className="shell-actions"><div className="horizon-control"><span>Horizonte</span><strong>36 meses</strong></div>{actionLabel && (actionHref ? <a className="primary-action shell-action-link" href={actionHref}>{actionLabel}</a> : <button className="primary-action" type="button">{actionLabel}</button>)}</div></div>
          {children}
        </div>
      </section>
    </main>
  );
}
