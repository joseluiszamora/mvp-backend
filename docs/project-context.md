# Contexto del proyecto

## Objetivo y estado

Panel Admin es un panel administrativo modular en español. La fase 2 incorporó autenticación y persistencia PostgreSQL mediante Prisma ORM 7. La fase 3 añade contenido privado de archivos, notificaciones de actividad, correo configurable y sellos de auditoría con retención. Los datos iniciales de las dos empresas son ficticios.

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
- Los nuevos archivos guardan contenido binario privado en PostgreSQL; los ejemplos iniciales siguen siendo muestras públicas. Las acciones generan avisos según las preferencias por cuenta y empresa. El correo se entrega desde una cola mediante Resend cuando está configurado. Los eventos de auditoría reciben sellos HMAC encadenados por empresa; el mantenimiento aplica la retención configurada conservando sellos.

## Límites y siguiente evolución

La instalación usa el proyecto Supabase `axafopilboigjqirodpa` como base externa PostgreSQL. El servidor Prisma requiere `DATABASE_URL` en `.env`. Ejecuta `npm ci` y `npm run db:migrate` antes del arranque. La segunda migración crea las tablas de contenido privado, cola de correo y sellos. `PANEL_AUDIT_HMAC_KEY` debe configurarse con al menos 32 bytes hexadecimales y conservarse entre despliegues. `RESEND_API_KEY` y `PANEL_EMAIL_FROM` activan el correo; `PANEL_MAINTENANCE_TOKEN` protege el proceso periódico de reintentos y retención. [docs/database.md](database.md) describe la operación. Las escrituras usan transacciones con bloqueo de PostgreSQL compartido entre instancias. La carga inicial filtra empresa, cuenta y permisos antes de transferir datos; las listas consultan su entidad. La auditoría inicial se limita a 500 eventos en la respuesta, pero los sellos cubren el historial completo. La recuperación por administrador existente cubre las cuentas de una empresa; la recuperación autónoma y el segundo factor se evaluarán cuando exista una política de identidad del producto. La fase 4 añadirá módulos de negocio.
