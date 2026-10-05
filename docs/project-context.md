# Contexto del proyecto

## Objetivo y estado

Panel Admin es un panel administrativo modular en español. La fase 2 incorpora autenticación con contraseña, sesiones revocables, autorización en servidor y persistencia SQLite. Los datos iniciales de las dos empresas son ficticios. Archivos, envíos de notificaciones y garantías de integridad de auditoría pertenecen a la fase 3.

## Tecnología y estructura

- Next.js 15 con App Router, React 19, TypeScript estricto, Tailwind CSS 4 y Node.js 24 o superior.
- Rutas y API en `src/app`, componentes visuales en `src/components`, entidades, reglas y contratos en `src/lib`.
- `src/lib/server/database.ts` abre SQLite, inicializa datos y credencial, guarda el estado versionado y administra sesiones.
- `src/lib/server/panel.ts` valida la sesión y el origen, proyecta solo los datos autorizados y ejecuta el contrato de `src/lib/demo-service.ts` con contexto establecido por el servidor.
- `src/components/protected-page.tsx` protege la carga de cada página de administración. La API comprueba de nuevo permisos y empresa en cada petición; ocultar un control en el cliente no concede autorización.
- `src/components/demo-provider.tsx` es el adaptador cliente de las API. Ya no persiste el estado de negocio en el navegador.

## Comportamiento

- El primer arranque de una base vacía usa `PANEL_ADMIN_BOOTSTRAP_EMAIL` y `PANEL_ADMIN_BOOTSTRAP_PASSWORD` para habilitar la cuenta administradora inicial. Las demás cuentas semilla no tienen credencial hasta que un administrador la establezca.
- El correo identifica una cuenta global; las membresías y los roles determinan sus permisos por empresa. El cambio de empresa solo admite membresías activas.
- Las sesiones se identifican con un token aleatorio en una cookie HTTP-only. El servidor almacena su resumen, vencimiento y empresa activa. Salir revoca la sesión; cambiar una contraseña revoca todas las sesiones de esa cuenta.
- El estado del panel se guarda como documento versionado en SQLite y las credenciales y sesiones en tablas separadas. El servicio valida lecturas y escrituras, incluidas las solicitudes enviadas directamente a la API.
- El tema, la densidad, el idioma inicial y los acentos claro y oscuro se guardan por cuenta y empresa en SQLite. `localStorage` solo ayuda a pintar el acento antes de cargar la sesión y recuerda el menú plegado.
- Los archivos de ejemplo todavía son metadatos y contenido público de muestra. Las notificaciones no se envían fuera de la aplicación. La auditoría persiste en el documento de estado pero aún no tiene controles de integridad o retención.

## Límites y siguiente evolución

La instalación actual usa un archivo SQLite y está pensada para una instancia de Node.js con disco persistente. El despliegue debe proporcionar HTTPS y configurar `PANEL_ADMIN_ORIGIN` con su URL pública. La fase 3 añadirá almacenamiento real de archivos, notificaciones externas y auditoría con garantías de integridad y retención; la fase 4 añadirá módulos de negocio. El estado del navegador de la fase 1 no se importa automáticamente.
