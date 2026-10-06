# Base de datos externa

## Conexión y migración

La aplicación utiliza Prisma ORM 7 y su adaptador `pg` con PostgreSQL. El motor se ha seleccionado como opción inicial; un cambio a MySQL o SQL Server requiere adaptar proveedor, adaptador y migración. Configura `DATABASE_URL` en `.env` tanto para Next.js como para los comandos de Prisma. No publiques credenciales.

```dotenv
DATABASE_URL="postgresql://USUARIO:CONTRASENA@HOST:5432/BASE?sslmode=require"
PANEL_ADMIN_BOOTSTRAP_EMAIL="admin@example.com"
PANEL_ADMIN_BOOTSTRAP_PASSWORD="REEMPLAZAR_CON_UNA_CONTRASENA_SEGURA"
PANEL_ADMIN_ORIGIN="http://localhost:3000"
```

La contraseña y el usuario de la URL deben estar codificados como componentes URI cuando contengan caracteres especiales. Configura TLS según el proveedor; no desactives la validación del certificado. No se incluyen credenciales reales en el repositorio.

Requiere Node.js 24 o superior:

```bash
npm ci
npm run db:validate
npm run db:migrate
npm run dev
```

`npm ci` genera el cliente Prisma mediante `postinstall`. `db:migrate` aplica migraciones pendientes y registra su historial; ejecuta este comando antes de desplegar. La aplicación no crea tablas al arrancar. Una base vacía se inicializa una sola vez con las entidades ficticias y la credencial configurada mediante las variables de arranque. Un bloqueo transaccional de PostgreSQL evita inicializaciones simultáneas.

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

Las fechas de las entidades conservan las cadenas ISO del contrato actual. Los tiempos de autenticación son `BIGINT` en milisegundos Unix. Los identificadores conservan los IDs de semillas y UUID generados por el servicio. Las FK de propietarios y actores restringen su eliminación; eliminar usuarios o membresías revoca sus sesiones por cascada. `entityId` de auditoría es una referencia polimórfica, sin FK. El campo `panel_state.organization_id` es metadato del contrato, sin FK.

Las API siguen validando sesión, membresía activa y permisos en el servidor. Las FK de archivos y notificaciones garantizan la existencia de cuenta y empresa; el servicio valida su ámbito. Los estados, categorías y permisos se validan en la capa de dominio.

## Transacciones y operación

Las lecturas del estado y las operaciones de negocio usan transacciones con `pg_advisory_xact_lock(721831)`. El bloqueo es compartido por todas las instancias conectadas a la misma base y evita pérdidas de actualizaciones durante el ciclo lectura/modificación/escritura. La escritura normaliza el contrato en las tablas, guarda preferencias como JSONB y sincroniza eliminaciones. Cambiar una contraseña y revocar sesiones es atómico; los incrementos de intentos fallidos también lo son.

Esta primera integración sigue cargando el estado completo y sincronizando sus entidades. El bloqueo global prioriza consistencia y serializa operaciones del panel. Para volúmenes altos conviene evolucionar a consultas y actualizaciones por entidad, paginación SQL y bloqueos más específicos. La auditoría aún no implementa inmutabilidad ni retención; los archivos y envíos siguen siendo de muestra.
