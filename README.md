# Panel Admin

Panel administrativo en español con Next.js 15, TypeScript, Tailwind y PostgreSQL externo mediante Prisma. La fase 2 incorpora acceso con contraseña, sesiones revocables, autorización en el servidor y persistencia de usuarios, membresías, roles, configuración y preferencias. Los registros iniciales siguen siendo ejemplos ficticios.

## Ejecutar

Requiere Node.js 24 o superior y npm. Las variables públicas de Supabase están en `.env`. Configura también `DATABASE_URL` con la URI PostgreSQL del proyecto y el correo y contraseña iniciales, siguiendo [la documentación de base de datos](docs/database.md). No incluyas `.env` en Git.

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run db:bootstrap
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con las credenciales configuradas. La cuenta inicial tiene rol Administrador en Andes Demo y Altiplano Demo. La conexión Prisma usa `DATABASE_URL` y requiere aplicar las migraciones antes del arranque. Las variables de bootstrap crean la credencial inicial; si las cambias después, ejecuta `npm run db:bootstrap` para sincronizar al administrador inicial. Para cambiar la contraseña desde la aplicación, usa Perfil → Cambiar contraseña.

Verifica con `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Las pruebas cubren reglas de dominio, aislamiento de empresas, caché de lecturas y guardados concurrentes de preferencias.

Para evaluar tiempos reales de navegación usa `npm run build` y luego `npm start`. `npm run dev` compila rutas a demanda y puede añadir varios segundos al primer acceso.

## Cuentas y sesiones

El administrador puede crear usuarios y establecer o cambiar la contraseña de cuentas que pertenecen a una sola empresa desde Usuarios → Editar → Acceso de esta cuenta. La contraseña se entrega por un canal seguro fuera del panel; todavía no hay correo ni invitaciones automáticas. Las cuentas que pertenecen a varias empresas cambian su propia contraseña desde Perfil.

La sesión usa una cookie HTTP-only, SameSite=Lax y un token aleatorio cuyo resumen se guarda en PostgreSQL. Vence a las 8 horas. Salir revoca la sesión actual; cambiar una contraseña revoca todas las sesiones de esa cuenta. Cinco intentos fallidos para un correo bloquean el acceso durante 15 minutos. Para desplegar el panel, usa HTTPS, configura `PANEL_ADMIN_ORIGIN` con la URL pública exacta y configura la base externa con TLS.

## Datos y límites actuales

- Usuarios, membresías, roles, permisos, empresas y preferencias se leen y escriben en el servidor. Cada petición valida la sesión, la empresa y el permiso correspondiente.
- Las dos empresas y los datos semilla se crean una sola vez. El administrador inicial tiene membresías independientes en ambas.
- Archivos, notificaciones y auditoría siguen usando registros de muestra. La selección de archivos guarda solo metadatos; no sube contenido. Los envíos y el almacenamiento de archivos reales corresponden a la fase 3.
- Prisma guarda las entidades en tablas relacionadas de PostgreSQL. Las transacciones y un bloqueo compartido entre instancias protegen las actualizaciones concurrentes. Solo se escriben registros modificados. La carga inicial obtiene una instantánea autorizada en una sola consulta; las listas tienen filtros y paginación SQL. Una consulta comprueba sesión, empresa, rol y módulos. Consulta [el diagrama, tablas y migración SQL](docs/database.md).
- El cliente deduplica y reutiliza lecturas en memoria hasta 15 segundos, sin volver a pedir las listas recién cargadas. Las búsquedas agrupan pulsaciones y la navegación precarga las rutas visibles. Los cambios de cuenta, empresa y datos invalidan la caché correspondiente.
- Las preferencias de apariencia se aplican al instante y se guardan en segundo plano por cuenta y empresa, con acentos independientes para los modos claro y oscuro. `localStorage` conserva solo la preferencia visual previa al inicio y el estado del menú lateral; ya no contiene el estado de negocio.
- El estado local de la antigua fase 1 y las bases SQLite existentes no se importan automáticamente a PostgreSQL.

## Estructura

- `src/app`: páginas App Router y rutas API.
- `src/components`: vistas, controles y protección de páginas.
- `src/lib/demo.ts`: entidades, registro de módulos, datos iniciales y reglas de permisos.
- `src/lib/demo-service.ts`: reglas de dominio y contrato asíncrono, ejecutados por el servidor.
- `src/lib/server`: Prisma, sesiones, lectura autorizada por empresa, consultas paginadas y escritura atómica de preferencias.
- `src/lib/panel-client.ts`: caché en memoria, conservación de referencias y cola de preferencias.
- `prisma/schema.prisma`: entidades y relaciones; `prisma/migrations`: SQL versionado.
- `prisma.config.ts`: configuración de conexión y migraciones.
- `src/lib/appearance.ts` y `src/app/globals.css`: paleta y tokens de temas.

Consulta [AGENTS.md](AGENTS.md), [el contexto del proyecto](docs/project-context.md) y [las instrucciones de evolución](docs/admin-panel-generico-instrucciones.md).
