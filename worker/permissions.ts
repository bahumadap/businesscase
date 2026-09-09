export type Yol1Role = "viewer" | "editor" | "data_manager" | "provider_admin" | "scenario_admin" | "admin";

export type Yol1Permission =
  | "read"
  | "edit"
  | "bulk_import"
  | "manage_providers"
  | "manage_scenarios"
  | "read_audit";

const ROLE_PERMISSIONS: Record<Yol1Role, readonly Yol1Permission[]> = {
  viewer: ["read"],
  editor: ["read", "edit"],
  data_manager: ["read", "edit", "bulk_import"],
  provider_admin: ["read", "edit", "bulk_import", "manage_providers"],
  scenario_admin: ["read", "edit", "manage_scenarios"],
  admin: ["read", "edit", "bulk_import", "manage_providers", "manage_scenarios", "read_audit"],
};

export type PermissionContext = { user: string; role: Yol1Role; enforced: boolean };

function parseRole(value: string | null): Yol1Role | null {
  return value && value in ROLE_PERMISSIONS ? value as Yol1Role : null;
}

/**
 * The auth proxy must overwrite these headers; clients must never be allowed to
 * choose their own role. Local development remains open until YOL1_AUTH_REQUIRED=true.
 */
export function permissionContext(request: Request, authRequired = false): PermissionContext | Response {
  const user = request.headers.get("x-yol1-user")?.trim();
  const role = parseRole(request.headers.get("x-yol1-role"));
  if (!authRequired) return { user: user || "local-development", role: role ?? "admin", enforced: false };
  if (!user || !role) return new Response(JSON.stringify({ error: "Autenticación y rol requeridos" }), { status: 401, headers: { "content-type": "application/json; charset=utf-8" } });
  return { user, role, enforced: true };
}

export function can(context: PermissionContext, permission: Yol1Permission) {
  return ROLE_PERMISSIONS[context.role].includes(permission);
}

export function denied(permission: Yol1Permission) {
  return new Response(JSON.stringify({ error: `Permiso insuficiente: ${permission}` }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
}

export function rolePermissions() {
  return ROLE_PERMISSIONS;
}
