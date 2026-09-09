"use client";

import { Fragment, useMemo, useState } from "react";

type Tone = "revenue" | "cost" | "margin" | "cashflow" | "cash";
type Row = { label: string; values: number[]; annual: number[]; tone: Tone; emphasis?: boolean; indent?: boolean; percentage?: boolean };
type Section = { title: string; subtitle: string; rows: Row[] };
type Period = { label: string; indexes: number[] };

function quarterGroups(calendar: string[]): Period[] {
  const groups = new Map<string, Period>();
  calendar.forEach((month, index) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const label = `Q${Math.ceil(monthNumber / 3)} ${year}`;
    const group = groups.get(label) ?? { label, indexes: [] };
    group.indexes.push(index);
    groups.set(label, group);
  });
  return [...groups.values()];
}

export function CashflowPeriodToggle({ calendar, sections, statuses, formatValue, revenueValues, marginValues }: { calendar: string[]; sections: Section[]; statuses?: boolean[]; formatValue: (value: number, percentage?: boolean) => string; revenueValues?: number[]; marginValues?: number[] }) {
  const [mode, setMode] = useState<"month" | "quarter">("month");
  const periods = useMemo(() => quarterGroups(calendar), [calendar]);
  const valuesFor = (row: Row) => periods.map((period) => {
    if (row.percentage && revenueValues && marginValues) {
      const revenue = period.indexes.reduce((sum, index) => sum + revenueValues[index], 0);
      return revenue ? period.indexes.reduce((sum, index) => sum + marginValues[index], 0) / revenue : 0;
    }
    return row.tone === "cash" ? row.values[period.indexes.at(-1) ?? 0] : period.indexes.reduce((sum, index) => sum + row.values[index], 0);
  });
  return <>
    <div className="enterprise-toolbar"><div className="cashflow-legend"><span className="legend-revenue">Revenue</span><span className="legend-cost">Costos / salidas</span></div><div className="grain-control compact-grain"><button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")} type="button">Mensual</button><button className={mode === "quarter" ? "active" : ""} onClick={() => setMode("quarter")} type="button">Trimestral</button></div></div>
    {mode === "quarter" && <><style>{`.horizontal-cashflow-panel{display:none}`}</style><article className="panel data-panel quarterly-cashflow-panel"><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table"><thead><tr className="year-band"><th>Concepto</th><th colSpan={periods.length}>Vista trimestral</th><th colSpan={3}>Resumen anual</th></tr><tr className="month-band"><th></th>{periods.map((period) => <th key={period.label}>{period.label}</th>)}{[1, 2, 3].map((year) => <th key={year} className="annual-column">Año {year}</th>)}</tr></thead><tbody>{sections.map((section) => <Fragment key={section.title}><tr className="cashflow-section-row"><th colSpan={periods.length + 4}><strong>{section.title}</strong><span>{section.subtitle} · USD</span></th></tr>{section.rows.map((row) => <tr key={`${section.title}-${row.label}`} className={`${row.tone}-row ${row.emphasis ? "emphasis-row" : ""}`}><th className={row.indent ? "indent-label" : ""}>{row.label}</th>{valuesFor(row).map((value, index) => <td key={index} className={value < 0 ? "value-negative" : value > 0 && (row.tone === "margin" || row.tone === "cashflow" || row.tone === "cash") ? "value-positive" : ""}>{formatValue(value, row.percentage)}</td>)}{row.annual.map((value, index) => <td key={index} className={`annual-column ${value < 0 ? "value-negative" : ""}`}>{formatValue(value, row.percentage)}</td>)}</tr>)}</Fragment>)}</tbody>{statuses && <tfoot><tr><th>Estado</th>{periods.map((period) => { const pending = period.indexes.some((index) => statuses[index]); return <td key={period.label}><span className={pending ? "pending-dot" : "complete-dot"}>{pending ? "Parcial" : "Completo"}</span></td>; })}{[0, 1, 2].map((year) => <td key={year} className="annual-column"><span className={statuses.slice(year * 12, year * 12 + 12).some(Boolean) ? "pending-dot" : "complete-dot"}>Resumen</span></td>)}</tr></tfoot>}</table></div></article></>}
  </>;
}
