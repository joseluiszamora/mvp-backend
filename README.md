# Panel Admin

Panel administrativo en español con Next.js 15, TypeScript, Tailwind y SQLite local. La fase 2 incorpora acceso con contraseña, sesiones revocables, autorización en el servidor y persistencia de usuarios, membresías, roles, configuración y preferencias. Los registros iniciales siguen siendo ejemplos ficticios.

## Ejecutar

Requiere Node.js 24 o superior y npm. Copia `.env.example` a `.env.local` y define un correo y una contraseña inicial de al menos 12 caracteres antes del primer arranque. No incluyas `.env.local` en Git.

```bash
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con las credenciales configuradas. La cuenta inicial tiene rol Administrador en Andes Demo y Altiplano Demo. La base se crea en `data/panel-admin.sqlite` por defecto; configura `PANEL_ADMIN_DB_PATH` para usar otra ruta persistente. Las variables de arranque solo crean la primera credencial en una base sin credenciales. Para cambiarla después, usa Perfil → Cambiar contraseña.

Verifica con `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`.

## Cuentas y sesiones

El administrador puede crear usuarios y establecer o cambiar la contraseña de cuentas que pertenecen a una sola empresa desde Usuarios → Editar → Acceso de esta cuenta. La contraseña se entrega por un canal seguro fuera del panel; todavía no hay correo ni invitaciones automáticas. Las cuentas que pertenecen a varias empresas cambian su propia contraseña desde Perfil.

La sesión usa una cookie HTTP-only, SameSite=Lax y un token aleatorio cuyo resumen se guarda en SQLite. Vence a las 8 horas. Salir revoca la sesión actual; cambiar una contraseña revoca todas las sesiones de esa cuenta. Cinco intentos fallidos para un correo bloquean el acceso durante 15 minutos. Para desplegar el panel, usa HTTPS, configura `PANEL_ADMIN_ORIGIN` con la URL pública exacta y monta un volumen persistente para SQLite.

## Datos y límites actuales

- Usuarios, membresías, roles, permisos, empresas y preferencias se leen y escriben en el servidor. Cada petición valida la sesión, la empresa y el permiso correspondiente.
- Las dos empresas y los datos semilla se crean una sola vez. El administrador inicial tiene membresías independientes en ambas.
- Archivos, notificaciones y auditoría siguen usando registros de muestra. La selección de archivos guarda solo metadatos; no sube contenido. Los envíos y el almacenamiento de archivos reales corresponden a la fase 3.
- SQLite guarda el estado del panel como un documento versionado y mantiene credenciales y sesiones en tablas separadas. Esta configuración está dirigida a una instancia de Node.js con almacenamiento local persistente; una instalación distribuida necesitará otra estrategia de base de datos.
- Las preferencias de apariencia se guardan por cuenta y empresa, con acentos independientes para los modos claro y oscuro. `localStorage` conserva solo la preferencia visual previa al inicio y el estado del menú lateral; ya no contiene el estado de negocio.
- El estado local de la antigua fase 1 no se importa automáticamente a SQLite.

## Estructura

- `src/app`: páginas App Router y rutas API.
- `src/components`: vistas, controles y protección de páginas.
- `src/lib/demo.ts`: entidades, registro de módulos, datos iniciales y reglas de permisos.
- `src/lib/demo-service.ts`: reglas de dominio y contrato asíncrono, ejecutados por el servidor.
- `src/lib/server`: SQLite, sesiones, proyección de datos por empresa y despacho autorizado.
- `src/lib/appearance.ts` y `src/app/globals.css`: paleta y tokens de temas.

Consulta [AGENTS.md](AGENTS.md), [el contexto del proyecto](docs/project-context.md) y [las instrucciones de evolución](docs/admin-panel-generico-instrucciones.md).
