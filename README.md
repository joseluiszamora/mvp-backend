# Panel Admin

Panel administrativo de demostración en Next.js. Incluye un resumen de usuarios, una página de usuarios con búsqueda y filtro, configuración de colores, menú adaptable y temas claro/oscuro. Los datos son ficticios y las rutas son públicas.

## Requisitos

- Node.js 20.9 o superior
- npm

## Ejecutar

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Para verificar el proyecto: `npm run lint`, `npm run typecheck` y `npm run build`. Para producción local: `npm run start` después de compilar.

## Estructura

- `src/app`: rutas `/`, `/usuarios` y `/configuracion`, layout y estilos globales.
- `src/components`: navegación, selector de tema, configuración visual y componentes compartidos.
- `src/lib/users.ts`: tipos y datos ficticios compartidos entre las dos páginas.
- `src/lib/appearance.ts`: opciones y claves de almacenamiento para los colores de acento.

El tema comienza con la preferencia del sistema. En Configuración puedes elegir por separado el color de acento de los modos claro y oscuro. El tema y ambos colores se guardan en este navegador; azul es el valor inicial.

Para contribuir o continuar el desarrollo, consulta [AGENTS.md](AGENTS.md) y [el contexto del proyecto](docs/project-context.md).
