# Contexto del proyecto

## Objetivo y estado actual

Panel Admin es una base visual y navegable para un futuro panel administrativo. Por ahora no hay autenticación, API ni base de datos. Las rutas son públicas y usan datos ficticios; cualquier ampliación debe distinguir claramente la demostración de una función real.

## Tecnología y estructura

- Next.js 15 con App Router, React 19 y TypeScript.
- Tailwind CSS 4 para estilos y `lucide-react` para iconos.
- `next-themes` para respetar inicialmente la preferencia del sistema y guardar el tema elegido.
- `src/app/page.tsx`: inicio con estadísticas y usuarios recientes.
- `src/app/usuarios/page.tsx`: ruta de usuarios; `src/components/users-view.tsx` aplica búsqueda por nombre o correo y filtro por estado.
- `src/components/app-shell.tsx`: cabecera, perfil de demostración y navegación adaptable.
- `src/components/ui.tsx`: componentes visuales compartidos.
- `src/lib/users.ts`: tipo `DemoUser`, usuario mostrado en cabecera y único conjunto de datos de ejemplo.
- `src/app/globals.css`: variables semánticas para temas claro y oscuro.

## Comportamiento que debe conservarse

- `/` calcula total, activos e inactivos desde `users` y muestra las incorporaciones más recientes.
- `/usuarios` combina búsqueda y estado; muestra un mensaje cuando no hay resultados. Usa tabla en pantallas medianas o grandes y tarjetas en móvil.
- El menú móvil se cierra al navegar, pulsar Escape o tocar fuera; la ruta activa queda señalada.
- El selector de tema conserva la preferencia tras recargar y evita diferencias de hidratación.

## Próximas ampliaciones

La estructura permite sustituir `src/lib/users.ts` por una fuente de datos real y añadir autenticación más adelante. Ninguna entidad, permiso ni contrato de API está definido todavía; documenta esas decisiones antes de implementarlas.
