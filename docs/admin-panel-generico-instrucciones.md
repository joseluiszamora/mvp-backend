# Instrucciones de desarrollo: panel administrativo genérico y modular

## 1. Objetivo

Construir una base de panel administrativo reutilizable para los productos de una empresa de software modular. Debe poder adaptarse a diferentes clientes mediante configuración y permitir agregar módulos sin rehacer la estructura visual.

La primera etapa será un prototipo navegable con datos ficticios e interacciones locales. Más adelante se conectarán autenticación, API, base de datos e integraciones reales.

Este documento puede entregarse a Codex como instrucciones de implementación. Implementar inicialmente solo la fase 1. Las fases siguientes describen la evolución prevista y no autorizan integrar servicios reales ahora.

## 2. Alcance inicial y decisiones

- Crear una aplicación web adaptable a escritorio, tablet y móvil.
- Conservar el stack y las convenciones de este proyecto: Next.js 15 con App Router, TypeScript estricto y Tailwind CSS.
- Usar una biblioteca consistente de componentes e iconos, evitando mezclar estilos.
- Interfaz inicial en español; preparar las etiquetas para futura traducción.
- Moneda inicial BOB, zona horaria `America/La_Paz` y formato de fecha `dd/MM/yyyy`, configurables por empresa.
- Trabajar sin backend, sin servicios externos y sin datos personales reales.
- Usar servicios mock asíncronos; las pantallas no deben importar directamente los datos semilla.
- Persistir cambios de demostración en almacenamiento local. No guardar contraseñas, secretos ni tokens reales.
- Incluir una opción «Restablecer demostración» con confirmación.
- Marcar el entorno como «Demo · Datos ficticios» de forma discreta y visible.

## 3. Principios de arquitectura

1. Separar estructura visual, módulos, configuración y acceso a datos.
2. Mantener las reglas de dominio fuera de los componentes visuales.
3. Preferir composición y componentes reutilizables a una pantalla genérica excesivamente compleja.
4. Hacer que cada módulo declare sus rutas, navegación y permisos.
5. Sustituir un servicio mock por un servicio HTTP sin reescribir las pantallas.
6. Mantener los módulos de negocio independientes del núcleo del panel.
7. Evitar microservicios, motores de plugins y abstracciones innecesarias en esta etapa.

Estructura orientativa dentro de las convenciones de este proyecto:

```text
src/
  app/                  # Rutas, layouts, metadatos y proveedores de App Router
  components/
    ui/                 # Controles visuales reutilizables
    layout/             # Cabecera, navegación y estructura compartida
    [funcion]/          # Componentes propios de una función, cuando hagan falta
  lib/
    modules/            # Registro común de módulos, navegación y permisos
    access/             # Sesión demo y evaluación de permisos
    config/             # Configuración y resolución de preferencias
    services/           # Contratos e implementaciones mock asíncronas
    mocks/              # Semillas deterministas y escenarios
    types/              # Tipos y contratos comunes
    utils/              # Fechas, moneda y validaciones comunes
public/                 # Logos e imágenes locales de demostración
```

Crear subcarpetas por función dentro de `src/app`, `src/components` y `src/lib` solo cuando la cantidad de archivos lo justifique. Cada módulo declara sus rutas, navegación y permisos en el registro común. Las páginas componen controles compartidos y componentes propios; no duplicar tablas, formularios ni diálogos. Mantener las reglas de dominio y el acceso a datos fuera de los componentes visuales. En esta fase solo se implementan servicios mock; los servicios HTTP se incorporarán cuando exista backend.

## 4. Configuración en tres niveles

| Nivel | Contenido | Quién lo modifica en la demo |
| --- | --- | --- |
| Producto | Nombre del producto, versión, registro de módulos y capacidades disponibles | Configuración del proyecto |
| Empresa | Nombre comercial, logos, favicon, colores, sucursales, moneda, zona horaria y módulos habilitados | Administrador de esa empresa |
| Usuario | Tema, acentos independientes para claro y oscuro, idioma, densidad, menú plegado, favoritos y columnas visibles | Cada usuario |

Usar valores predeterminados cuando falte una configuración. Las preferencias de usuario solo pueden sobreescribir propiedades permitidas; nunca deben alterar permisos, módulos contratados o ajustes de otra empresa.

Persistir la configuración empresarial por `organizationId`, y las preferencias por usuario y organización. No mezclar los datos de las empresas en tablas, indicadores ni archivos.

## 5. Identidad visual y apariencia

Implementar:

- Tema claro, oscuro y automático según el dispositivo.
- Persistencia del tema y aplicación al cargar para evitar destellos de un tema incorrecto.
- Logo para fondo claro, logo para fondo oscuro y versión compacta del menú.
- Nombre del sistema, título del navegador y favicon configurables.
- Color principal y color de acento mediante tokens o variables CSS.
- Selección y persistencia independientes del color de acento para los temas claro y oscuro, incluso cuando el tema esté en modo automático. Conservar ambas elecciones al incorporar preferencias por usuario y empresa; no fusionarlas en un único valor.
- Valores predeterminados y vista previa de cambios antes de guardar.
- Restauración de la identidad visual inicial.
- Densidad cómoda y compacta para tablas.

Usar colores semánticos de éxito, advertencia, error e información. Validar que el branding permita leer textos y distinguir controles en ambos temas. Si un color personalizado produce poco contraste, mostrar una advertencia y conservar combinaciones legibles.

Mantener una vista previa separada para cada tema. Si se amplía la paleta de acentos, actualizar `src/lib/appearance.ts`, las reglas de ambos temas en `src/app/globals.css` y la vista previa de Configuración.

Para logos y favicon, permitir seleccionar PNG, JPEG o WebP locales de hasta 2 MB. Validar tipo, mostrar vista previa y gestionar archivos inválidos. No admitir HTML ni SVG proporcionado por el usuario en esta etapa. Las imágenes elegidas deben permanecer disponibles tras recargar dentro de las limitaciones del almacenamiento local; informar si se alcanza su capacidad.

## 6. Layout y navegación

- Barra lateral con grupos de módulos, opción activa e iconos consistentes.
- Menú plegable en escritorio y drawer en móvil.
- Barra superior con selector de empresa, tema, notificaciones y menú de usuario.
- Breadcrumbs y título de página con acción principal cuando corresponda.
- Favoritos o accesos rápidos por usuario.
- Página 404 y página de acceso denegado.
- Navegación directa por URL y conservación de filtros en la URL cuando sea práctico.

El menú debe construirse a partir del registro de módulos. Ocultar módulos deshabilitados y opciones sin permisos; también proteger la navegación directa a sus rutas.

No agregar un buscador global decorativo. Si se implementa, debe buscar al menos rutas o módulos accesibles y permitir navegar a un resultado.

## 7. Pantallas e interacciones de la fase 1

### 7.1 Acceso de demostración

Crear una pantalla de acceso con branding configurable y selección de cuentas ficticias. No solicitar contraseñas reales. Permitir iniciar y cerrar una sesión demo, seleccionar el contexto empresarial y cambiar de rol para revisar el comportamiento del panel.

La recuperación de contraseña y el segundo factor se incorporarán después. Si se muestran ahora, identificarlos como pendientes y explicar que no envían correos ni verifican códigos.

### 7.2 Dashboard

- Mostrar tarjetas con usuarios activos, archivos, notificaciones pendientes y actividad reciente.
- Calcular indicadores a partir del mismo conjunto mock usado por los listados.
- Agregar una gráfica sencilla de actividad con datos semilla deterministas.
- Mostrar accesos rápidos compatibles con el rol.
- Adaptar el dashboard cuando el usuario no tenga permisos para algún indicador.

### 7.3 Usuarios

- Listado con nombre, correo ficticio, rol, estado y fecha de creación.
- Búsqueda, filtro por rol y estado, ordenamiento y paginación.
- Crear, consultar y editar usuarios mediante formulario reutilizable.
- Activar o desactivar con confirmación.
- Seleccionar filas y realizar una acción masiva permitida.
- Exportar CSV de los resultados filtrados, excluyendo columnas no autorizadas.
- Validar campos obligatorios y correo duplicado dentro de la empresa.
- Evitar desactivar o quitar acceso al último administrador activo de una empresa.

### 7.4 Roles y permisos

- Listar roles y mostrar una matriz de permisos por módulo y acción.
- Permitir crear y editar roles ficticios cuando el usuario esté autorizado.
- Incluir permisos de lectura, creación, edición, desactivación y exportación según el módulo.
- Aplicar cambios inmediatamente en menú, rutas y acciones.
- Evitar que un editor se conceda permisos que no posee.
- Proteger el rol administrador base contra cambios que dejen a la empresa sin administración.

Los permisos locales solo simulan el comportamiento de la interfaz. En la fase real, el backend deberá comprobar cada operación y el aislamiento entre empresas.

### 7.5 Empresa y sucursales

- Mostrar datos de la empresa seleccionada y sus sucursales.
- Editar datos generales ficticios y agregar o editar sucursales.
- Cambiar de empresa únicamente entre las disponibles para la cuenta demo.
- Al cambiar, limpiar selección de filas y datos transitorios, y cargar branding, preferencias y registros de la empresa destino.
- Si hay cambios sin guardar, pedir al usuario que guarde o descarte antes de cambiar.

### 7.6 Configuración

Organizar en pestañas: identidad visual, regional, módulos y preferencias personales.

- Guardar branding y ajustes regionales por empresa.
- Habilitar o deshabilitar módulos opcionales de la demo.
- No permitir deshabilitar acceso, permisos o configuración esencial.
- Mantener accesible la configuración al deshabilitar el módulo actual; navegar a una ruta permitida.
- Guardar preferencias personales por usuario.
- Mostrar feedback de guardado y errores de validación.

### 7.7 Archivos

- Listar archivos ficticios con nombre, tipo, tamaño, fecha y propietario.
- Filtrar por tipo y buscar por nombre.
- Seleccionar un archivo local de hasta 5 MB y registrar sus metadatos para simular la carga.
- Aclarar que esta operación no sube el contenido a un servidor.
- Permitir renombrar y eliminar registros con los permisos adecuados.
- Usar archivos de muestra locales para una descarga demostrable. No ofrecer descargas para metadatos cuyo contenido no esté disponible.

### 7.8 Notificaciones

- Listado y contador de no leídas derivados del mismo estado.
- Marcar una o todas como leídas.
- Navegar a una ruta relacionada solo si sigue disponible y autorizada.
- Preferencias ficticias por categoría y canal; indicar que no se envían mensajes externos.

### 7.9 Auditoría

- Listado de actor, fecha, módulo, acción y entidad afectada.
- Filtros por módulo, usuario y rango de fechas.
- Detalle con valores anteriores y posteriores relevantes.
- Agregar registros al crear o editar usuarios, roles, configuración y archivos.
- No permitir editar o eliminar eventos desde la interfaz.

El registro demo se puede restablecer y modificar desde el navegador; no tiene garantías de auditoría real. No almacenar contraseñas ni información sensible en eventos.

### 7.10 Perfil

- Mostrar nombre, correo ficticio, rol y empresas disponibles.
- Editar nombre y avatar de demostración.
- Configurar tema, idioma inicial y densidad.
- Mostrar las sesiones ficticias como una vista preparatoria; no presentar su cierre como revocación real.

## 8. Componentes compartidos

Crear y reutilizar:

- Layout, encabezado de página y breadcrumbs.
- Tabla con filtros, paginación, selección y columnas configurables.
- Campos de formulario y mensajes de validación.
- Modal o drawer de edición y diálogo de confirmación.
- Toast de resultado, badge de estado y avatar.
- Selector de empresa, tema y archivos.
- Skeleton de carga, estado vacío, estado de error con reintento y acceso denegado.

Cada botón debe ejecutar una interacción visible o explicar por qué está deshabilitado. Evitar enlaces sin destino y acciones que solo muestran un mensaje de éxito sin cambiar el estado esperado.

## 9. Modelo mínimo de datos y contratos

Usar identificadores estables, fechas ISO y referencias coherentes. No guardar fechas ya formateadas como fuente de datos.

| Entidad | Campos mínimos |
| --- | --- |
| Organization | id, name, slug, branding, locale, timezone, currency, enabledModules |
| Branch | id, organizationId, name, address, status |
| User | id, name, email, avatar, status, createdAt |
| Membership | id, organizationId, userId, roleId, status |
| Role | id, organizationId, name, permissions, protected |
| UserPreferences | userId, organizationId, theme, accentLight, accentDark, locale, density, favorites, tableColumns |
| FileRecord | id, organizationId, name, mimeType, size, ownerId, createdAt, sampleAssetPath opcional |
| Notification | id, organizationId, userId, title, message, readAt, createdAt, targetRoute opcional |
| AuditEvent | id, organizationId, actorId, module, action, entityId, before, after, createdAt |

Separar el usuario de su pertenencia a una empresa: una misma persona puede tener un rol distinto en cada organización.

Los servicios deben devolver promesas y aceptar el contexto empresarial. Definir contratos para:

- Obtener listas con búsqueda, filtros, orden y paginación.
- Obtener detalle, crear y actualizar entidades cuando corresponda.
- Modificar configuración y preferencias.
- Obtener y marcar notificaciones.
- Consultar auditoría.

Usar una respuesta paginada consistente: `items`, `total`, `page` y `pageSize`. Estandarizar errores de validación, acceso denegado, entidad inexistente y fallo de servicio. Un servicio mock debe verificar también el contexto y los permisos demo para que las reglas no dependan únicamente de un botón oculto.

## 10. Datos ficticios y escenarios

Crear semillas reproducibles, sin depender de una API pública:

- Dos empresas: «Andes Demo» y «Altiplano Demo», con branding distinto.
- Dos sucursales por empresa.
- Veinticuatro usuarios ficticios y membresías coherentes; al menos una cuenta con acceso a ambas empresas.
- Roles Administrador, Editor y Consulta en cada empresa.
- Quince archivos de muestra, doce notificaciones y cuarenta eventos de auditoría distribuidos entre empresas.
- Correos bajo `example.com`, por ejemplo `admin.andes@example.com`.

Matriz inicial:

| Rol | Acceso de demostración |
| --- | --- |
| Administrador | Gestiona usuarios, roles, sucursales, configuración, archivos y auditoría de su empresa |
| Editor | Consulta y edita usuarios no administradores y archivos; sin gestión de roles ni configuración empresarial |
| Consulta | Consulta dashboard, usuarios y archivos; sin cambios ni exportación |

Todos los roles pueden gestionar su propio perfil, preferencias y notificaciones. Definir códigos de permiso explícitos, por ejemplo `users.read`, `users.create`, `users.update`, `users.deactivate`, `users.export`, `roles.manage`, `settings.manage` y `audit.read`.

Simular una latencia configurable breve. Ofrecer escenarios de carga, vacío y error activables para verificar la interfaz; no introducir fallos aleatorios que vuelvan impredecible la demo.

Persistir los datos con una clave propia y una versión de esquema. Si el estado almacenado es incompatible o está corrupto, recuperar de forma controlada la semilla y avisar. Restablecer la demo debe afectar solo a las claves de esta aplicación.

## 11. Calidad visual y accesibilidad

- Mantener consistencia de espaciado, tipografía, bordes y tamaños de controles.
- Asegurar lectura y contraste en ambos temas.
- No comunicar estados solo mediante color.
- Usar etiquetas visibles para campos y nombres accesibles para botones con iconos.
- Permitir navegación por teclado y mostrar el foco.
- Gestionar el foco al abrir y cerrar modales; permitir cierre con Escape cuando sea apropiado.
- Evitar desbordamiento horizontal de toda la página. Las tablas anchas pueden tener desplazamiento dentro de su contenedor.
- Respetar preferencias de movimiento reducido.
- Mostrar fechas en la zona horaria configurada y valores monetarios con la moneda seleccionada.

## 12. Orden de implementación y entregables

### Fase 1 — Prototipo funcional con datos ficticios

Los siguientes entregables son acumulativos. Cada uno debe quedar navegable y verificable antes de iniciar el siguiente; completar un entregable no equivale a completar la fase 1.

1. **Base de datos demo y módulos:** definir tipos, contratos asíncronos, semillas deterministas, persistencia local versionada, escenarios controlados y registro común de rutas, navegación y permisos. Debe funcionar el restablecimiento confirmado de la demo y la recuperación informada de un estado almacenado incompatible o corrupto. Verificar coherencia de referencias, aislamiento por empresa, respuesta paginada y ausencia de fallos aleatorios.
2. **Estructura, apariencia y acceso demo:** implementar layout adaptable, branding, temas, acentos independientes, selección de empresa, sesión demo y evaluación de permisos en rutas y acciones. Deben funcionar el cambio de tema y empresa, la navegación directa autorizada y el cierre de sesión demo. Verificar persistencia visual, menú móvil y de escritorio, foco y teclado, carga de preferencias de la empresa destino y acceso denegado para rutas restringidas.
3. **Usuarios y roles:** implementar listados, filtros, orden, paginación, formularios, acciones permitidas, exportación y matriz de permisos sobre los servicios mock. Las modificaciones deben reflejarse en los listados y permisos de inmediato. Verificar validaciones, CSV, prevención de escalada de permisos, protección del último administrador y separación de registros entre empresas.
4. **Configuración y servicios de uso diario:** implementar empresa y sucursales, configuración, perfil, archivos y notificaciones con componentes compartidos. Deben funcionar guardado local, cambios de módulos habilitados, selección de archivos, descargas de muestras disponibles y marcado de notificaciones. Verificar cambios sin guardar, validación de imágenes y tamaños, rutas deshabilitadas, preferencias por usuario y empresa, y contador sincronizado.
5. **Auditoría y dashboard:** registrar acciones demo relevantes y mostrar indicadores, actividad y accesos rápidos coherentes con los mismos datos mock. Deben funcionar filtros y detalle de auditoría, así como la actualización de indicadores tras cambios. Verificar que los eventos no se editen desde la interfaz, que no contengan secretos y que cada rol vea solo datos y acciones autorizados.

Al cerrar cada entregable, actualizar el README y `docs/project-context.md` cuando cambien comandos, estructura, alcance o decisiones del producto. Al cerrar la fase, entregar código ejecutable, instrucciones de instalación y ejecución, cuentas demo, lista de funcionalidades simuladas y comprobaciones realizadas. La fase 1 solo termina cuando se cumplen todos los criterios de aceptación de la sección 13. No publicar ni conectar servicios reales como parte de esta fase.

### Fase 2 — Autenticación y backend reales

- Elegir proveedor o implementación de autenticación según el producto.
- Sustituir la sesión demo y conectar usuarios, membresías, roles y permisos.
- Validar autorización e aislamiento empresarial en el servidor.
- Definir manejo de sesión, expiración, errores y revocación.
- Migrar configuración empresarial y preferencias a persistencia real.

### Fase 3 — Servicios transversales

- Almacenamiento de archivos con permisos y validaciones del servidor.
- Notificaciones reales y preferencias de envío.
- Auditoría persistente con controles de integridad y retención.
- Recuperación de contraseña y segundo factor si el producto los requiere.

### Fase 4 — Módulos de negocio

Agregar facturación, ventas, inventario, reservas u otros módulos según el primer cliente. Cada módulo deberá declarar rutas, menú, permisos y contratos. Los widgets del dashboard serán específicos para los datos que aporte cada módulo.

## 13. Criterios de aceptación de la fase 1

Los números entre paréntesis indican el entregable responsable de cada criterio; la comprobación final se realiza sobre la fase completa.

- [ ] (1) El proyecto se ejecuta siguiendo sus instrucciones, sin credenciales externas.
- [ ] (1–2) Existen dos empresas con datos y branding diferenciados.
- [ ] (2) El tema claro, oscuro y automático funciona y persiste; cada tema conserva su propio acento.
- [ ] (2–4) Cambiar logos, nombre y colores actualiza las superficies correspondientes.
- [ ] (2–4) Menú, rutas y acciones respetan módulos habilitados y rol seleccionado.
- [ ] (2) Las URL directas no permiten acceder a vistas restringidas en la demo.
- [ ] (2–4) Cambiar de empresa no mezcla registros ni conserva selecciones de la anterior.
- [ ] (3–5) Crear y editar usuarios modifica listados, indicadores y auditoría.
- [ ] (3) Búsqueda, filtros, ordenamiento y paginación funcionan de manera combinada.
- [ ] (3) Cambiar un filtro reinicia la página para evitar resultados aparentemente vacíos.
- [ ] (3) La exportación contiene los resultados filtrados autorizados y usa escapes CSV correctos.
- [ ] (3–4) Los formularios validan y advierten de cambios sin guardar.
- [ ] (3) Los permisos de roles se aplican sin permitir escaladas desde la interfaz demo.
- [ ] (4) Las notificaciones y su contador permanecen sincronizados.
- [ ] (4) Las descargas ofrecidas tienen contenido de muestra disponible.
- [ ] (1–5) Hay estados de carga, vacío, error y acceso denegado comprobables.
- [ ] (1–4) La persistencia sobrevive a la recarga y el restablecimiento recupera la semilla.
- [ ] (2–5) La interfaz es usable a 360 px, 768 px y 1440 px de ancho.
- [ ] (2–5) No existen controles decorativos que aparenten acciones implementadas.
- [ ] (1–5) No se envían correos, pagos, archivos ni notificaciones a servicios externos.
- [ ] (1–5) El build y las comprobaciones disponibles del proyecto pasan sin errores.

## 14. Verificación y forma de trabajar con Codex

Implementar los cinco entregables de la sección 12 en el orden indicado. Después de cada uno, comprobar su comportamiento antes de ampliar el alcance y actualizar la documentación del proyecto cuando corresponda.

Priorizar pruebas útiles para resolución de permisos, aislamiento entre empresas y contratos de servicios. Verificar manualmente tema, branding, formularios, tablas y navegación con los tres roles. No agregar pruebas que solo repitan el contenido estático de componentes.

Al cerrar la fase, informar qué funciona, qué está simulado y qué queda pendiente. Mantener un README del proyecto y evitar presentar el prototipo como un sistema listo para producción.

### Instrucción para iniciar la implementación

> Implementa los cinco entregables de la fase 1 de este documento, en el orden de la sección 12: un panel administrativo modular con datos ficticios, interacciones locales, branding configurable, temas con acentos independientes, permisos demo y servicios sustituibles. Conserva Next.js App Router, TypeScript y Tailwind, y respeta la estructura indicada en la sección 3. Verifica los criterios de aceptación de la sección 13 y documenta cómo ejecutar y restablecer la demo. No integres backend, autenticación real ni servicios externos en esta etapa.
