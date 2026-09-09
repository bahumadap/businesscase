type PlanningEnv = { DB?: D1Database; YOL1_AUTH_REQUIRED?: string };
import { can, denied, permissionContext } from "./permissions";

const CREATE_PLANNING_STATE = `CREATE TABLE IF NOT EXISTS planning_state (
  key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_AUDIT_LOG = `CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  actor TEXT NOT NULL,
  entity TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  changed_at TEXT NOT NULL
)`;

const CREATE_AUDIT_CHANGED_AT_INDEX = `CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log (changed_at)`;
const CREATE_AUDIT_ENTITY_INDEX = `CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity)`;

async function ensurePlanningState(env: PlanningEnv) {
  if (!env.DB) throw new Error("D1 binding DB is not available");
  await env.DB.batch([
    env.DB.prepare(CREATE_PLANNING_STATE),
    env.DB.prepare(CREATE_AUDIT_LOG),
    env.DB.prepare(CREATE_AUDIT_CHANGED_AT_INDEX),
    env.DB.prepare(CREATE_AUDIT_ENTITY_INDEX),
  ]);
  return env.DB;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

type AuditChange = { entity: string; action: "create" | "update" | "delete"; before: unknown; after: unknown };

function recordId(value: unknown, index: number) {
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  if (value && typeof value === "object" && "accountCode" in value && typeof value.accountCode === "string") return value.accountCode;
  return String(index);
}

function diffPlans(key: string, before: unknown, after: unknown): AuditChange[] {
  if (!before) return [{ entity: key, action: "create", before: null, after }];
  if (!before || typeof before !== "object" || !after || typeof after !== "object") return [{ entity: key, action: "update", before, after }];
  const changes: AuditChange[] = [];
  const beforeObject = before as Record<string, unknown>;
  const afterObject = after as Record<string, unknown>;
  const fields = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
  const settingsBefore: Record<string, unknown> = {};
  const settingsAfter: Record<string, unknown> = {};
  for (const field of fields) {
    const oldValue = beforeObject[field];
    const newValue = afterObject[field];
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      const oldRows = Array.isArray(oldValue) ? oldValue : [];
      const newRows = Array.isArray(newValue) ? newValue : [];
      const oldMap = new Map(oldRows.map((value, index) => [recordId(value, index), value]));
      const newMap = new Map(newRows.map((value, index) => [recordId(value, index), value]));
      for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
        const oldRow = oldMap.get(id);
        const newRow = newMap.get(id);
        if (JSON.stringify(oldRow) === JSON.stringify(newRow)) continue;
        changes.push({ entity: `${key}:${field}:${id}`, action: oldRow === undefined ? "create" : newRow === undefined ? "delete" : "update", before: oldRow ?? null, after: newRow ?? null });
      }
    } else if (field !== "updatedAt" && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      settingsBefore[field] = oldValue;
      settingsAfter[field] = newValue;
    }
  }
  if (Object.keys(settingsAfter).length) changes.push({ entity: `${key}:settings`, action: "update", before: settingsBefore, after: settingsAfter });
  return changes.length ? changes : [{ entity: key, action: "update", before, after }];
}

export async function handlePlanningApi(request: Request, env: PlanningEnv, key = "enterprise-plan") {
  try {
    const context = permissionContext(request, env.YOL1_AUTH_REQUIRED === "true");
    if (context instanceof Response) return context;
    const db = await ensurePlanningState(env);
    if (request.method === "GET") {
      if (!can(context, "read")) return denied("read");
      const row = await db.prepare("SELECT payload, updated_at FROM planning_state WHERE key = ?").bind(key).first<{ payload: string; updated_at: string }>();
      return json({ plan: row ? JSON.parse(row.payload) : null, updatedAt: row?.updated_at ?? null });
    }
    if (request.method === "PUT") {
      const permission = key === "providers-plan" ? "manage_providers" : "edit";
      if (!can(context, permission)) return denied(permission);
      const plan = await request.json<unknown>();
      const payload = JSON.stringify(plan);
      if (payload.length > 2_000_000) return json({ error: "El modelo excede el tamaño permitido" }, 413);
      const updatedAt = new Date().toISOString();
      const previous = await db.prepare("SELECT payload FROM planning_state WHERE key = ?").bind(key).first<{ payload: string }>();
      const before = previous ? JSON.parse(previous.payload) : null;
      const actor = context.user;
      const changes = diffPlans(key, before, plan);
      await db.batch([
        db.prepare("INSERT INTO planning_state (key, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind(key, payload, updatedAt),
        ...changes.map((change) => db.prepare("INSERT INTO audit_log (id, actor, entity, action, before_json, after_json, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor, change.entity, change.action, JSON.stringify(change.before), JSON.stringify(change.after), updatedAt)),
      ]);
      return json({ ok: true, updatedAt });
    }
    return json({ error: "Método no permitido" }, 405);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No fue posible guardar el modelo" }, 500);
  }
}

export async function handleAuditApi(request: Request, env: PlanningEnv) {
  try {
    const context = permissionContext(request, env.YOL1_AUTH_REQUIRED === "true");
    if (context instanceof Response) return context;
    const db = await ensurePlanningState(env);
    if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);
    if (!can(context, "read_audit")) return denied("read_audit");
    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));
    const entity = url.searchParams.get("entity")?.trim();
    const result = entity
      ? await db.prepare("SELECT id, actor, entity, action, before_json, after_json, changed_at FROM audit_log WHERE entity LIKE ? ORDER BY changed_at DESC LIMIT ?").bind(`%${entity}%`, limit).all()
      : await db.prepare("SELECT id, actor, entity, action, before_json, after_json, changed_at FROM audit_log ORDER BY changed_at DESC LIMIT ?").bind(limit).all();
    return json({ entries: result.results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No fue posible leer la auditoría" }, 500);
  }
}
