import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const planningState = sqliteTable("planning_state", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  entity: text("entity").notNull(),
  action: text("action").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  changedAt: text("changed_at").notNull(),
}, (table) => [
  index("idx_audit_log_changed_at").on(table.changedAt),
  index("idx_audit_log_entity").on(table.entity),
]);
