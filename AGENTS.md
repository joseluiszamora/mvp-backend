# Instrucciones para agentes

Este repositorio contiene **Panel Admin**, un panel administrativo en español con datos iniciales ficticios y persistencia SQLite. Antes de modificarlo, lee [docs/project-context.md](docs/project-context.md) para conocer el alcance y la estructura actual.

## Trabajo en el proyecto

- Usa Next.js App Router, TypeScript estricto y Tailwind CSS. Mantén las rutas en `src/app`, los componentes compartidos en `src/components` y los datos y tipos comunes en `src/lib`.
- Los textos visibles al usuario deben estar en español. Conserva las etiquetas accesibles, el foco visible y la navegación por teclado.
- Mantén el diseño adaptable: menú lateral permanente en escritorio, menú desplegable en móvil y contenido sin desbordamiento horizontal.
- Respeta los temas claro y oscuro. Usa las variables de color definidas en `src/app/globals.css`; evita colores fijos que pierdan contraste al cambiar de tema.
- Conserva la selección independiente de color de acento para cada tema. Si añades un color, actualiza `src/lib/appearance.ts`, las reglas de ambos temas en `src/app/globals.css` y la vista previa de Configuración.
- Añade `"use client"` solo donde haya estado, efectos o interacción del navegador. Prefiere componentes de servidor para páginas y contenido estático.
- Las semillas de usuarios ficticios están centralizadas en `src/lib/users.ts`. Las credenciales, sesiones y el estado de negocio viven en el servidor; valida empresa y permisos en cada nueva operación de API. No coloques contraseñas ni tokens en el estado cliente, la auditoría o el repositorio.
- Mantén Node.js 24 o superior para `node:sqlite`. No restaures el acceso demo sin contraseña ni la persistencia de negocio en `localStorage`.
- Si agregas una página, incorpora su enlace al menú cuando corresponda, metadatos y estados vacíos o de error pertinentes.
- Actualiza el README y el documento de contexto si cambian los comandos, la estructura, el alcance o las decisiones del producto.

## Verificación

Instala dependencias con `npm ci`. Antes de entregar cambios de código, ejecuta:

```bash
npm run lint
npm run typecheck
npm run build
```

Para cambios visuales o de interacción, revisa en navegador las rutas afectadas en móvil y escritorio, ambos temas y la navegación mediante teclado. Escribe pruebas automatizadas cuando cubran comportamiento nuevo o un fallo concreto; evita pruebas que solo repitan la implementación.
