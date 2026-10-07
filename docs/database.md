# Base de datos externa

## Conexión y migración

La aplicación usa el proyecto Supabase `axafopilboigjqirodpa` como PostgreSQL externo, con Prisma ORM 7 y el adaptador `pg`. `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son configuración pública del cliente; Prisma no puede usar la clave publicable como conexión PostgreSQL. Prisma usa `DATABASE_URL` (pooler transaccional, puerto 6543) en ejecución y `DIRECT_URL` (pooler de sesión, puerto 5432) para Prisma Migrate. Ambas conexiones requieren TLS. Con `sslmode=require` el tráfico se cifra, pero el certificado del servidor no se valida; para validar también el certificado, descarga la CA de Supabase y configura `sslmode=verify-full` y `sslrootcert`. `uselibpqcompat=true` mantiene en el driver `pg` la semántica de `require` de PostgreSQL. Ambas URI incluyen la contraseña y se guardan solo en `.env`; rótala si se comparte fuera del entorno local. El SQL de Prisma también está en `supabase/migrations/` para el flujo Supabase CLI. La migración `20261006000000_external_database` ya quedó aplicada al proyecto y verificada: existen las 13 tablas, todas tienen RLS activado y los roles `anon` y `authenticated` no pueden leer credenciales.

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://axafopilboigjqirodpa.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_REEMPLAZAR"
DATABASE_URL="postgresql://postgres.PROJECT_REF:CONTRASENA@POOLER_HOST:6543/postgres?pgbouncer=true&sslmode=require&uselibpqcompat=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:CONTRASENA@POOLER_HOST:5432/postgres?sslmode=require&uselibpqcompat=true"
PANEL_ADMIN_BOOTSTRAP_EMAIL="admin@example.com"
PANEL_ADMIN_BOOTSTRAP_PASSWORD="REEMPLAZAR_CON_UNA_CONTRASENA_SEGURA"
PANEL_ADMIN_ORIGIN="http://localhost:3000"
```

La contraseña y el usuario de la URL deben estar codificados como componentes URI cuando contengan caracteres especiales. Configura TLS según el proveedor; no desactives la validación del certificado. No se incluyen credenciales reales en el repositorio.

La URL, clave publicable y URI PostgreSQL del proyecto están guardadas en el `.env` local, ignorado por Git. `DATABASE_URL` usa el pooler transaccional; `DIRECT_URL` usa el pooler de sesión para migraciones.

Para aplicar desde la raíz del repositorio con Prisma:

```bash
npm run db:migrate
```

También puedes pegar `supabase/migrations/20261006000000_external_database.sql` en el SQL Editor del proyecto, o usar Supabase CLI autenticado (`supabase link --project-ref axafopilboigjqirodpa` seguido de `supabase db push`). Escoge un solo método para aplicar la migración.

Requiere Node.js 24 o superior:

```bash
npm ci
npm run db:validate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm ci` genera el cliente Prisma mediante `postinstall`. `db:migrate` aplica migraciones pendientes y registra su historial; ejecuta este comando antes de desplegar. El comando `npm run db:seed` inserta una sola vez las empresas, sucursales, usuarios, membresías, roles, archivos y notificaciones de muestra, eventos de auditoría y la credencial administradora de bootstrap. El seed está protegido por una transacción y un bloqueo compartido; volverlo a ejecutar en una base ya inicializada no reemplaza registros. Requiere `PANEL_ADMIN_BOOTSTRAP_EMAIL` y `PANEL_ADMIN_BOOTSTRAP_PASSWORD` en `.env`. El arranque de la aplicación conserva también su inicialización automática si falta el marcador de estado. Cambiar después las variables de bootstrap no modifica la cuenta ya guardada; en ese caso ejecuta `npm run db:bootstrap`, que sincroniza correo y contraseña solo para el administrador inicial de Andes, rechaza correos duplicados y revoca sus sesiones anteriores.

El SQL de creación de tablas, índices y claves foráneas está en [migration.sql](../prisma/migrations/20261006000000_external_database/migration.sql). Está generado desde [schema.prisma](../prisma/schema.prisma). Para nuevas modificaciones usa `npm run db:migrate:dev -- --name descripcion` en una base de desarrollo; usa `db:migrate` en producción. No ejecutes simultáneamente el SQL manual y Prisma Migrate. Si un DBA aplica el SQL manualmente, registra después la migración con `npx prisma migrate resolve --applied 20261006000000_external_database`.

**Alcance de esta migración:** crea el esquema PostgreSQL en una base o esquema vacío. No copia datos de `data/panel-admin.sqlite` ni convierte una base externa con tablas preexistentes. Si hay datos SQLite que conservar, realiza una copia, detén las escrituras y prepara una importación separada del documento `app_state`, credenciales, sesiones e intentos de acceso antes del cambio. No borres el archivo original hasta comprobar la importación. Las semillas no sustituyen datos históricos.

## Diagrama de entidades y relaciones

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ BRANCHES : contiene
    ORGANIZATIONS ||--o{ ROLES : define
    ORGANIZATIONS ||--o{ MEMBERSHIPS : agrupa
    USERS ||--o{ MEMBERSHIPS : pertenece
    ROLES ||--o{ MEMBERSHIPS : asigna
    MEMBERSHIPS ||--o| PREFERENCES : configura
    MEMBERSHIPS ||--o{ SESSIONS : autoriza
    USERS ||--o| CREDENTIALS : autentica
    ORGANIZATIONS ||--o{ FILES : contiene
    USERS ||--o{ FILES : posee
    ORGANIZATIONS ||--o{ NOTIFICATIONS : contiene
    USERS ||--o{ NOTIFICATIONS : recibe
    ORGANIZATIONS ||--o{ AUDIT_EVENTS : registra
    USERS ||--o{ AUDIT_EVENTS : actua
    FILES ||--o| FILE_BLOBS : almacena
    ORGANIZATIONS ||--o{ AUDIT_SEALS : verifica
    ORGANIZATIONS ||--o{ EMAIL_OUTBOX : envia
    USERS ||--o{ EMAIL_OUTBOX : recibe
    PANEL_STATE {
        int id PK
        int version
        string organization_id
    }
    ORGANIZATIONS {
        string id PK
        string slug UK
        string name
        int sortOrder
        string currency
        string timezone
        string_array enabledModules
    }
    BRANCHES {
        string id PK
        string organizationId FK
        string name
        string address
        string status
    }
    USERS {
        string id PK
        string email UK
        string name
        string createdAt
    }
    ROLES {
        string id PK
        string organizationId FK
        string name
        string_array permissions
        boolean protected
    }
    MEMBERSHIPS {
        string id PK
        string userId FK
        string organizationId FK
        string roleId FK
        string status
    }
    PREFERENCES {
        string userId PK,FK
        string organizationId PK,FK
        jsonb payload
    }
    FILES {
        string id PK
        string organizationId FK
        string ownerId FK
        string name
        int size
    }
    NOTIFICATIONS {
        string id PK
        string organizationId FK
        string userId FK
        string title
        string readAt
    }
    AUDIT_EVENTS {
        string id PK
        string organizationId FK
        string actorId FK
        string entityId
        jsonb before
        jsonb after
    }
    CREDENTIALS {
        string user_id PK,FK
        string salt
        string password_hash
        bigint changed_at
    }
    SESSIONS {
        string token_hash PK
        string user_id FK
        string organization_id FK
        bigint expires_at
        bigint created_at
    }
    LOGIN_ATTEMPTS {
        string email PK
        int failures
        bigint blocked_until
    }
    FILE_BLOBS {
        string file_id PK,FK
        bytes content
        string checksum
    }
    AUDIT_SEALS {
        string event_id PK
        string organization_id FK
        bigint sequence
        string chain_hash
    }
    EMAIL_OUTBOX {
        string id PK
        string organization_id FK
        string user_id FK
        string status
        int attempts
    }
```

## Tablas e integridad

| Tabla | Clave y propósito |
| --- | --- |
| `panel_state` | Fila `id=1`, versión del contrato y empresa seleccionada por defecto. No contiene el documento de negocio ni secretos. |
| `organizations` | Empresa, marca, moneda, zona horaria, módulos habilitados y orden de presentación. Slug único. |
| `branches` | Sucursales asociadas a una empresa. |
| `users` | Cuenta global, correo único normalizado por el servicio, perfil y fecha de creación. |
| `roles` | Rol de empresa, permisos y protección. Nombre único por empresa. |
| `memberships` | Usuario, empresa, estado y rol. Única por usuario/empresa; la FK compuesta de rol impide asignar un rol de otra empresa. |
| `preferences` | PK compuesta usuario/empresa, FK a membresía y configuración JSONB; incluye acentos independientes por tema. |
| `files` | Metadatos, dueño y empresa. No almacena archivos reales. |
| `notifications` | Destinatario, empresa, categoría, contenido, lectura y destino de navegación. |
| `audit_events` | Actor, empresa, módulo, acción, entidad y valores anterior/posterior JSONB. No incluye contraseñas ni tokens. |
| `credentials` | Una credencial por usuario; sal aleatoria y hash scrypt. |
| `sessions` | Hash SHA-256 del token, membresía, creación y vencimiento. Índices por usuario y vencimiento. |
| `login_attempts` | Contador y bloqueo temporal por correo; admite correos inexistentes para controlar intentos fallidos. |
| `file_blobs` | Contenido privado y SHA-256 de un archivo; se elimina con su registro. |
| `audit_seals` | Cadena HMAC por empresa; conserva sellos al expirar eventos. |
| `email_outbox` | Entregas de correo pendientes, enviadas o fallidas con reintentos. |

Las fechas de las entidades conservan las cadenas ISO del contrato actual. Los tiempos de autenticación son `BIGINT` en milisegundos Unix. Los identificadores conservan los IDs de semillas y UUID generados por el servicio. Las FK de propietarios y actores restringen su eliminación; eliminar usuarios o membresías revoca sus sesiones por cascada. `entityId` de auditoría es una referencia polimórfica, sin FK. El campo `panel_state.organization_id` es metadato del contrato, sin FK.

Las tablas se crean con RLS activado y sin políticas Data API; además, la migración revoca `PUBLIC`, `anon`, `authenticated` y `service_role`. Las credenciales y sesiones solo son accesibles con la conexión directa de servidor de Prisma. No conectes el navegador a estas tablas con la clave publicable: los permisos de la aplicación se comprueban en sus rutas de servidor.

## Servicios de la fase 3

Aplica `20261006010000_transversal_services` con `npm run db:migrate` antes de iniciar la nueva versión. La migración añade `file_blobs`, `audit_seals` y `email_outbox`; se incluye el mismo SQL en `supabase/migrations/`. No vuelvas a aplicar la migración inicial. Configura estas variables en el servidor:

```dotenv
PANEL_AUDIT_HMAC_KEY="64_O_MAS_CARACTERES_HEXADECIMALES_ALEATORIOS"
PANEL_AUDIT_RETENTION_DAYS="365"
PANEL_MAINTENANCE_TOKEN="TOKEN_ALEATORIO_DE_32_CARACTERES_O_MAS"
RESEND_API_KEY=""
PANEL_EMAIL_FROM=""
```

Genera una clave HMAC de 32 bytes con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdala fuera del repositorio. No la cambies después de sellar eventos: la verificación usa la misma clave para todo el historial. `PANEL_AUDIT_RETENTION_DAYS` admite entre 30 y 3650 días; el valor predeterminado es 365.

Los nuevos archivos se reciben por `/api/files` en multipart, se limitan a 5 MB por archivo y 100 MB de contenido por empresa, y admiten PDF, PNG, JPEG, WebP y texto UTF-8. El servidor comprueba tamaño, nombre y firma; `file_blobs` guarda el contenido y un SHA-256, comprobado al descargar. La descarga por `/api/files/:id` valida sesión, empresa y permiso `files.read` y devuelve el contenido como adjunto. Eliminar el registro borra el contenido por cascada. Los registros semilla siguen apuntando a muestras públicas.

Las operaciones de negocio generan avisos para las otras cuentas activas de la empresa según sus preferencias. La entrega de correo requiere `RESEND_API_KEY` y `PANEL_EMAIL_FROM` con un remitente verificado en Resend. La cola `email_outbox` guarda intentos, reintentos y resultado; la petición principal confirma la transacción antes de intentar entregar. Los reintentos se procesan con una llamada periódica `POST /api/maintenance` y encabezado `Authorization: Bearer <PANEL_MAINTENANCE_TOKEN>`. No expongas el token en el navegador. El mantenimiento purga entregas enviadas o fallidas con más de 30 días. Un administrador ve los recuentos de correos pendientes, en reintento y fallidos en Notificaciones. Los mensajes son genéricos y no incluyen valores de auditoría ni secretos.

Cada evento nuevo recibe un sello HMAC en una cadena por empresa. Al primer arranque tras la migración se sellan los eventos anteriores; en arranques posteriores, un evento sin sello bloquea el mantenimiento para que no se legitime una alteración. `GET /api/audit/integrity` comprueba la cadena y el contenido conservado. El mantenimiento elimina eventos que superan la retención y conserva sus sellos; la verificación permite que falte solo contenido ya vencido. La cadena detecta cambios de eventos y sellos intermedios, aunque por sí sola no detecta el borrado simultáneo del extremo final de la cadena y sus eventos. Para una garantía frente a un administrador de la base, exporta periódicamente la última huella a un sistema externo inmutable.

Las API siguen validando sesión, membresía activa y permisos en el servidor. Las FK de archivos y notificaciones garantizan la existencia de cuenta y empresa; el servicio valida su ámbito. Los estados, categorías y permisos se validan en la capa de dominio.

## Transacciones y operación

Las escrituras de negocio usan transacciones con `pg_advisory_xact_lock(721831)`; las lecturas del estado usan una única sentencia SQL con agregaciones JSON, coherente por la instantánea MVCC de PostgreSQL, sin adquirir ese bloqueo. El bloqueo es compartido por todas las instancias conectadas a la misma base y evita pérdidas de actualizaciones durante el ciclo lectura/modificación/escritura. La escritura compara el estado anterior y posterior, actualiza solo registros modificados, guarda preferencias como JSONB mediante upsert y sincroniza eliminaciones cuando existen. Cambiar una contraseña y revocar sesiones es atómico; los incrementos de intentos fallidos también lo son.

La carga inicial filtra cuenta, empresa y permisos en SQL; la auditoría inicial se limita a los 500 eventos más recientes. Las API de listas consultan únicamente su entidad, con filtros y paginación SQL (máximo 500 registros por página), sin incluir una copia del estado. Usuarios se ordena con la colación española `es-x-icu`, disponible en este proyecto Supabase; otros PostgreSQL deben disponer de esa colación ICU. Una única consulta con JOIN valida vigencia de sesión, membresía activa, permisos y módulos; React solo la reutiliza dentro del render actual. El guardado de preferencias consulta únicamente la membresía y preferencia propias; un CTE escribe preferencia y auditoría juntas. Las demás mutaciones aún cargan el contrato completo, en una sola sentencia, y persisten diferencias bajo el bloqueo global. Para volúmenes altos conviene completar la migración de esas mutaciones a operaciones por entidad y bloqueos más específicos.

El navegador reutiliza las listas de la carga inicial durante un máximo de 15 segundos y deduplica lecturas por cuenta, empresa, método y filtros (máximo 128 entradas en memoria). Al caducar, la siguiente consulta vuelve al servidor. Refrescar, salir, cambiar de empresa y modificar datos invalidan las entradas pertinentes; los cambios de preferencias actualizan solo las preferencias y la auditoría autorizada. No hay caché compartida de permisos entre peticiones ni persistencia de datos de negocio en localStorage.
