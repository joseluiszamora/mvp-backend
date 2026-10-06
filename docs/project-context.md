# Contexto del proyecto

## Objetivo y estado

Panel Admin es un panel administrativo modular en español. La fase 2 incorpora autenticación con contraseña, sesiones revocables, autorización en servidor y persistencia PostgreSQL mediante Prisma ORM 7. Los datos iniciales de las dos empresas son ficticios. Archivos, envíos de notificaciones y garantías de integridad de auditoría pertenecen a la fase 3.

## Tecnología y estructura

- Next.js 15 con App Router, React 19, TypeScript estricto, Tailwind CSS 4 y Node.js 24 o superior.
- Rutas y API en `src/app`, componentes visuales en `src/components`, entidades, reglas y contratos en `src/lib`.
- `src/lib/server/database.ts` conecta PostgreSQL con Prisma y el adaptador `pg`, inicializa datos y credencial, convierte el contrato de estado en tablas relacionadas y administra sesiones.
- `src/lib/server/panel.ts` valida la sesión y el origen, proyecta solo los datos autorizados y ejecuta el contrato de `src/lib/demo-service.ts` con contexto establecido por el servidor.
- `src/components/protected-page.tsx` protege la carga de cada página de administración. La API comprueba de nuevo permisos y empresa en cada petición; ocultar un control en el cliente no concede autorización.
- `src/components/demo-provider.tsx` es el adaptador cliente de las API. `src/lib/panel-client.ts` deduplica lecturas en memoria durante 15 segundos, conserva referencias de listas sin cambios y serializa/fusiona guardados de preferencias. No persiste datos de negocio en el navegador.
- `src/lib/server/panel-reads.ts` consulta listas por empresa con filtros y paginación SQL. `src/lib/server/preferences.ts` guarda únicamente la preferencia propia y su evento de auditoría dentro de una transacción.

## Comportamiento

- El primer arranque de una base vacía usa `PANEL_ADMIN_BOOTSTRAP_EMAIL` y `PANEL_ADMIN_BOOTSTRAP_PASSWORD` para habilitar la cuenta administradora inicial. Las demás cuentas semilla no tienen credencial hasta que un administrador la establezca.
- El correo identifica una cuenta global; las membresías y los roles determinan sus permisos por empresa. El cambio de empresa solo admite membresías activas.
- Las sesiones se identifican con un token aleatorio en una cookie HTTP-only. El servidor almacena su resumen, vencimiento y empresa activa. Salir revoca la sesión; cambiar una contraseña revoca todas las sesiones de esa cuenta.
- Las entidades del panel, credenciales y sesiones se guardan en tablas relacionadas de PostgreSQL; las preferencias y valores de auditoría usan JSONB. El servicio valida lecturas y escrituras, incluidas las solicitudes enviadas directamente a la API.
- El tema, la densidad, el idioma inicial y los acentos claro y oscuro se guardan por cuenta y empresa en PostgreSQL. `localStorage` solo ayuda a pintar el acento antes de cargar la sesión y recuerda el menú plegado.
- Los archivos de ejemplo todavía son metadatos y contenido público de muestra. Las notificaciones no se envían fuera de la aplicación. La auditoría persiste en su tabla pero aún no tiene controles de integridad o retención.

## Límites y siguiente evolución

La instalación usa el proyecto Supabase `axafopilboigjqirodpa` como base externa PostgreSQL. El cliente público se configura con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; el servidor Prisma requiere además `DATABASE_URL` con credenciales PostgreSQL, guardada solo en `.env`. Ejecuta `npm ci` para generar el cliente y `npm run db:migrate` antes del arranque. El esquema Prisma está en `prisma/`, y el SQL aplicable desde Supabase está en `supabase/migrations/`; [docs/database.md](database.md) documenta tablas, diagrama y comandos. Las bases SQLite existentes no se importan automáticamente. Las escrituras del panel usan transacciones con un bloqueo de PostgreSQL compartido entre instancias y guardan únicamente entidades modificadas y eliminaciones. La carga inicial usa una única sentencia SQL con agregaciones JSON y filtra empresa, cuenta y permisos antes de transferir datos; incluye como máximo 500 eventos recientes. Las listas usan consultas específicas y no devuelven el estado completo. La validación de sesión obtiene vigencia, membresía, permisos y módulos en un solo JOIN, reutilizado únicamente dentro del render actual. Las preferencias se aplican de forma optimista y su guardado no recarga listas ajenas. Las demás mutaciones todavía cargan el contrato global, ahora en una sola sentencia coherente, y persisten diferencias. La caché cliente se invalida al refrescar, mutar datos o cambiar de identidad; la auditoría se actualiza con el evento devuelto al guardar preferencias. El despliegue debe proporcionar HTTPS y configurar `PANEL_ADMIN_ORIGIN` con su URL pública. La fase 3 añadirá almacenamiento real de archivos, notificaciones externas y auditoría con garantías de integridad y retención; la fase 4 añadirá módulos de negocio. El estado del navegador de la fase 1 no se importa automáticamente.
