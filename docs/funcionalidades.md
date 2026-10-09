# Guía de funcionalidades

Esta guía describe lo que ofrece Panel Admin actualmente y las condiciones para usar cada función. La interfaz está en español. Los datos de inicio de Andes Demo y Altiplano Demo son ficticios; las cuentas, membresías y cambios que se hacen desde el panel se guardan en PostgreSQL.

## Acceso y alcance

- Inicia sesión con el correo y la contraseña configurados para el administrador inicial. Las demás cuentas semilla no tienen contraseña hasta que un administrador habilite su acceso.
- Cada cuenta puede tener una membresía y un rol distintos en cada empresa. El selector de empresa solo muestra membresías activas y los datos se limitan a la empresa seleccionada.
- Las páginas y las API validan la sesión, la membresía, el permiso y el módulo habilitado en el servidor. El menú solo muestra las opciones autorizadas.
- La sesión se conserva en una cookie HTTP-only y vence a las 8 horas. Cerrar sesión la revoca. Cambiar la contraseña también revoca las sesiones de esa cuenta.
- Cinco intentos fallidos bloquean el acceso por 15 minutos. El contador se reinicia al terminar el bloqueo.

## Secciones del panel

| Sección | Funciones disponibles |
| --- | --- |
| **Inicio** | Indicadores de usuarios activos, archivos, notificaciones pendientes y actividad reciente, según los permisos de la cuenta. El gráfico de siete días usa datos de muestra deterministas; no representa una serie analítica real. Los accesos rápidos respetan módulos, permisos y favoritos. |
| **Usuarios** | Buscar por nombre o correo, filtrar por rol y estado, ordenar por nombre y paginar. Permite abrir la ficha con nombre, correo, fotografía, rol, estado y fecha de alta; crear y editar usuarios; subir, reemplazar o quitar una fotografía PNG, JPEG o WebP de hasta 2 MB; activar o desactivar membresías; y exportar a CSV los resultados filtrados. Nombre, correo y fotografía pertenecen a la cuenta global; rol y estado dependen de la empresa. El acceso a una cuenta se habilita aparte con una contraseña inicial; no se envían invitaciones ni correos de contraseña. |
| **Roles** | Crear roles y configurar permisos de empresa. Los roles base protegidos no se editan. El servidor impide conceder permisos que quien administra no posee y evita que una edición produzca una escalada. |
| **Empresa** | Cambiar el nombre comercial y agregar o editar sucursales, sus direcciones y estados. Moneda y zona horaria se muestran aquí y se administran en Configuración → Regional. |
| **Configuración** | Cambiar identidad visual, color principal, logos para claro/oscuro, logo compacto y favicon; previsualizar la marca; ajustar moneda, zona horaria y módulos opcionales. Las preferencias personales incluyen tema, densidad de tablas, accesos favoritos, columnas de usuarios, idioma inicial y acentos independientes para los temas claro y oscuro. |
| **Archivos** | Buscar y filtrar por tipo. Las cuentas autorizadas pueden subir archivos privados de hasta 5 MB, renombrarlos y eliminarlos. Se admite PDF, PNG, JPEG, WebP y texto UTF-8. La empresa tiene un límite de 100 MB. El servidor revisa nombre, tipo declarado y firma del contenido; verifica el SHA-256 al descargar. Los archivos semilla son muestras y no contenido privado subido. |
| **Notificaciones** | Consultar avisos propios de la empresa, abrir el módulo de destino y marcar uno o todos como leídos. Las preferencias permiten seleccionar canal de panel o correo y categorías de actividad o sistema. El correo solo se puede activar cuando el proveedor está configurado. Administración puede ver recuentos de entregas pendientes, reintentos y fallidas. |
| **Auditoría** | Consultar eventos recientes de la empresa y filtrar por módulo, actor y fechas; abrir los valores anterior y posterior cuando estén registrados. El permiso `audit.read` habilita la vista y la comprobación de sellos. Se muestran hasta 500 eventos recientes; la comprobación de integridad cubre la cadena completa, también los sellos cuyo contenido ya venció por retención. |
| **Perfil** | Actualizar el perfil personal y cambiar la contraseña con la contraseña actual. La nueva contraseña debe tener al menos 12 caracteres. Al cambiarla se cierran todas las sesiones de la cuenta. |

## Roles y permisos iniciales

Cada empresa empieza con roles independientes. La matriz se puede cambiar desde Roles cuando la cuenta tiene `roles.manage`.

| Rol inicial | Permisos semilla |
| --- | --- |
| **Administrador** | Todos los permisos disponibles: usuarios, roles, configuración, archivos, auditoría y administración de empresa. Es un rol base protegido. |
| **Editor** | Ver y editar usuarios; ver y administrar archivos. No puede crear usuarios, cambiar roles ni administrar la empresa. |
| **Consulta** | Ver usuarios y archivos, sin modificar esos registros. |

Permisos disponibles: `users.read`, `users.create`, `users.update`, `users.deactivate`, `users.export`, `roles.manage`, `settings.manage`, `files.read`, `files.manage`, `audit.read` y `organization.manage`. La visibilidad del enlace depende del permiso de entrada del módulo; acciones específicas requieren además su permiso propio.

## Preferencias y presentación

- La preferencia de tema puede ser claro, oscuro o automática según el sistema operativo.
- El acento elegido para el tema claro se conserva por separado del acento oscuro. Cambiar de empresa o cuenta carga la preferencia correspondiente.
- La densidad compacta afecta las filas de la tabla de usuarios. Los favoritos se usan en los accesos rápidos del inicio y las columnas configuradas afectan esa tabla.
- El menú lateral se puede contraer en escritorio y se convierte en menú desplegable en pantallas pequeñas.
- La aplicación refresca datos y avisos al volver a la pestaña y cada minuto mientras permanece visible.

## Correo, auditoría y operación

El panel y los datos principales funcionan con PostgreSQL y Prisma. El correo saliente requiere `RESEND_API_KEY` y `PANEL_EMAIL_FROM` configurados en el servidor. Las notificaciones por correo se encolan junto con el cambio de negocio y se envían después de confirmar la transacción. Una tarea periódica debe llamar `POST /api/maintenance` con `Authorization: Bearer <PANEL_MAINTENANCE_TOKEN>` para procesar reintentos y aplicar retención; no llames esa API desde el navegador.

La auditoría enlaza eventos por empresa con una clave HMAC. `PANEL_AUDIT_HMAC_KEY` debe tener al menos 32 bytes hexadecimales y mantenerse estable. `PANEL_AUDIT_RETENTION_DAYS` configura la retención (30–3650 días, 365 por defecto); al expirar un evento se conserva su sello. Una huella externa del último sello mejora la detección de truncamiento malicioso del final de la cadena.

Consulta [Base de datos externa](database.md) para configurar PostgreSQL, aplicar migraciones, correo y mantenimiento. Para instalar y arrancar el panel, consulta el [README](../README.md).

## Funciones que aún no ofrece

- La recuperación autónoma de contraseña, el segundo factor y las invitaciones por correo no están implementados. Un administrador habilita o cambia la contraseña de otra cuenta desde Usuarios; cada persona cambia la suya desde Perfil.
- No hay módulos de facturación, ventas, inventario ni reservas. Las opciones dependen de los módulos disponibles en la aplicación.
- El gráfico del inicio y los registros semilla sirven para demostración, no para reportes de negocio.
- Los archivos se almacenan en PostgreSQL; no hay integración con almacenamiento externo ni vista previa de documentos.
- La selección de idioma inicial y la densidad son preferencias guardadas, pero la interfaz disponible permanece en español y la densidad compacta se aplica actualmente a Usuarios.
