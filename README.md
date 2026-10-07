# Panel Admin

Panel administrativo en español con Next.js 15, TypeScript, Tailwind y PostgreSQL externo mediante Prisma. La fase 3 incorpora archivos privados, avisos de actividad, correo con cola de entrega y auditoría con sellos de integridad y retención. Los registros iniciales siguen siendo ejemplos ficticios.

## Ejecutar

Requiere Node.js 24 o superior y npm. Copia [.env.example](.env.example) a `.env` y configura la conexión PostgreSQL, credencial inicial y clave de auditoría, siguiendo [la documentación de base de datos](docs/database.md). No incluyas `.env` en Git.

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con las credenciales configuradas. La cuenta inicial tiene rol Administrador en Andes Demo y Altiplano Demo. La conexión Prisma usa `DATABASE_URL` y requiere aplicar las migraciones antes del arranque. Las variables de bootstrap crean la credencial inicial; si las cambias después, ejecuta `npm run db:bootstrap` para sincronizar al administrador inicial. Para cambiar la contraseña desde la aplicación, usa Perfil → Cambiar contraseña.

Verifica con `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Las pruebas cubren reglas de dominio, aislamiento de empresas, caché de lecturas y guardados concurrentes de preferencias.

Para evaluar tiempos reales de navegación usa `npm run build` y luego `npm start`. `npm run dev` compila rutas a demanda y puede añadir varios segundos al primer acceso.

## Cuentas y sesiones

El administrador puede crear usuarios y establecer o cambiar la contraseña de cuentas que pertenecen a una sola empresa desde Usuarios → Editar → Acceso de esta cuenta. La contraseña se entrega por un canal seguro fuera del panel; todavía no hay correo ni invitaciones automáticas. Las cuentas que pertenecen a varias empresas cambian su propia contraseña desde Perfil.

La sesión usa una cookie HTTP-only, SameSite=Lax y un token aleatorio cuyo resumen se guarda en PostgreSQL. Vence a las 8 horas. Salir revoca la sesión actual; cambiar una contraseña revoca todas las sesiones de esa cuenta. Cinco intentos fallidos para un correo bloquean el acceso durante 15 minutos; después empieza un contador nuevo. Para desplegar el panel, usa HTTPS, configura `PANEL_ADMIN_ORIGIN` con la URL pública exacta y configura la base externa con TLS.

## Datos y límites actuales

- Usuarios, membresías, roles, permisos, empresas y preferencias se leen y escriben en el servidor. Cada petición valida la sesión, la empresa y el permiso correspondiente.
- Las dos empresas y los datos semilla se crean una sola vez. El administrador inicial tiene membresías independientes en ambas.
- Los nuevos archivos se guardan como contenido binario privado en PostgreSQL, con límite de 5 MB, tipo y firma comprobados en el servidor. Los archivos semilla conservan sus descargas de muestra. La descarga privada exige sesión, empresa y permiso.
- Las acciones generan avisos para otras cuentas activas de la empresa según sus preferencias. El correo usa una cola transaccional y Resend cuando se configuran `RESEND_API_KEY` y `PANEL_EMAIL_FROM`; el panel muestra si el correo está disponible. Configura una llamada periódica a `/api/maintenance` con `PANEL_MAINTENANCE_TOKEN` para reintentos y retención. Sin proveedor, no se aceptan nuevas preferencias de correo.
- Cada evento de auditoría recibe un sello HMAC encadenado por empresa. La vista permite comprobar integridad; el mantenimiento purga contenido anterior a `PANEL_AUDIT_RETENTION_DAYS` y conserva los sellos como evidencia. La clave `PANEL_AUDIT_HMAC_KEY` es necesaria para arrancar y debe mantenerse estable y secreta.
- Prisma guarda las entidades en tablas relacionadas de PostgreSQL. Las transacciones y un bloqueo compartido entre instancias protegen las actualizaciones concurrentes. Solo se escriben registros modificados. La carga inicial obtiene una instantánea autorizada en una sola consulta; las listas tienen filtros y paginación SQL. Una consulta comprueba sesión, empresa, rol y módulos. Consulta [el diagrama, tablas y migración SQL](docs/database.md).
- El cliente deduplica y reutiliza lecturas en memoria hasta 15 segundos, sin volver a pedir las listas recién cargadas. Las búsquedas agrupan pulsaciones y la navegación precarga las rutas visibles. Los cambios de cuenta, empresa y datos invalidan la caché correspondiente.
- Mientras la sesión esté activa, el panel refresca los avisos y demás datos al recuperar el foco o cada minuto visible.
- Las preferencias de apariencia se aplican al instante y se guardan en segundo plano por cuenta y empresa, con acentos independientes para los modos claro y oscuro. `localStorage` conserva solo la preferencia visual previa al inicio y el estado del menú lateral; ya no contiene el estado de negocio.
- El estado local de la antigua fase 1 y las bases SQLite existentes no se importan automáticamente a PostgreSQL.

## Estructura

- `src/app`: páginas App Router y rutas API.
- `src/components`: vistas, controles y protección de páginas.
- `src/lib/demo.ts`: entidades, registro de módulos, datos iniciales y reglas de permisos.
- `src/lib/demo-service.ts`: reglas de dominio y contrato asíncrono, ejecutados por el servidor.
- `src/lib/server`: Prisma, sesiones, lectura autorizada, contenido de archivos, cola de correo y auditoría sellada.
- `src/lib/panel-client.ts`: caché en memoria, conservación de referencias y cola de preferencias.
- `prisma/schema.prisma`: entidades y relaciones; `prisma/migrations`: SQL versionado.
- `prisma.config.ts`: configuración de conexión y migraciones.
- `src/lib/appearance.ts` y `src/app/globals.css`: paleta y tokens de temas.

Consulta [AGENTS.md](AGENTS.md), [el contexto del proyecto](docs/project-context.md) y [las instrucciones de evolución](docs/admin-panel-generico-instrucciones.md).

Para conocer las funciones, permisos y límites actuales, consulta la [guía de funcionalidades](docs/funcionalidades.md). La configuración y operación de PostgreSQL, correo y mantenimiento se describen en [docs/database.md](docs/database.md).
