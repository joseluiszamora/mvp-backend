import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { DemoError, type ListQuery, type Permission } from "@/lib/demo";
import type { AuthorizedSession, Database } from "@/lib/server/database";

export const readMethods = new Set(["listUsers", "listRoles", "listFiles", "listNotifications", "listAudit"]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DemoError("VALIDATION", "Solicitud inválida.");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new DemoError("VALIDATION", "Filtro inválido.");
  return value;
}

function pagination(query: Record<string, unknown>): Required<Pick<ListQuery, "page" | "pageSize">> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1 || page > 1_000_000
    || typeof pageSize !== "number" || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new DemoError("VALIDATION", "Paginación inválida (máximo 500 registros por página).");
  }
  return { page, pageSize };
}

export async function runReadOperation(db: Database, session: AuthorizedSession, method: string, args: unknown[]): Promise<unknown> {
  const query = method === "listUsers" ? object(args[0]) : object(args[1] ?? {});
  const organizationId = method === "listUsers" ? query.organizationId : args[0];
  if (organizationId !== session.organizationId) throw new DemoError("DENIED", "Empresa no autorizada.");
  const permissions: Record<string, Permission> = { listUsers: "users.read", listRoles: "roles.manage", listFiles: "files.read", listAudit: "audit.read" };
  const permission = permissions[method];
  if (permission && !session.permissions.includes(permission)) throw new DemoError("DENIED", "No tienes permiso para esta operación.");
  if (method === "listRoles") return db.role.findMany({ where: { organizationId: session.organizationId }, orderBy: { id: "asc" } });
  if (method === "listNotifications") return db.notification.findMany({ where: { organizationId: session.organizationId, userId: session.userId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });

  const { page, pageSize } = pagination(query);
  const search = text(query.search).trim().toLocaleLowerCase("es");
  let matched: Prisma.Sql;
  let order: Prisma.Sql;
  switch (method) {
    case "listUsers": {
      const role = text(query.roleId), status = text(query.status);
      matched = Prisma.sql`SELECT u.*, m."organizationId", m."roleId", m.status FROM users u
        JOIN memberships m ON m."userId" = u.id WHERE m."organizationId" = ${session.organizationId}
        AND (${search} = '' OR strpos(lower(u.name || u.email), ${search}) > 0)
        AND (${role} = '' OR m."roleId" = ${role}) AND (${status} = '' OR m.status = ${status})`;
      order = query.sort === "desc" ? Prisma.sql`name COLLATE "es-x-icu" DESC, id` : Prisma.sql`name COLLATE "es-x-icu" ASC, id`;
      break;
    }
    case "listFiles": {
      const mime = text(query.mimeType);
      matched = Prisma.sql`SELECT * FROM files WHERE "organizationId" = ${session.organizationId}
        AND (${search} = '' OR strpos(lower(name), ${search}) > 0) AND (${mime} = '' OR "mimeType" = ${mime})`;
      order = Prisma.sql`"createdAt" DESC, id`;
      break;
    }
    case "listAudit":
      matched = Prisma.sql`SELECT * FROM audit_events WHERE "organizationId" = ${session.organizationId}`;
      order = Prisma.sql`"createdAt" DESC, id`;
      break;
    default: throw new DemoError("NOT_FOUND", "Operación desconocida.");
  }
  // Una sola consulta devuelve página y total sin cargar otras tablas o empresas.
  const rows = await db.$queryRaw<{ result: unknown }[]>(Prisma.sql`
    WITH matched AS (${matched}), page AS (SELECT * FROM matched ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize})
    SELECT jsonb_build_object('items', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY ${order}) FROM page p), '[]'::jsonb),
      'total', (SELECT count(*) FROM matched), 'page', ${page}::integer, 'pageSize', ${pageSize}::integer) AS result
  `);
  return rows[0].result;
}
