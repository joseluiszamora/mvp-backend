# Panel Admin

Panel administrativo de demostración en Next.js. Incluye un resumen de usuarios, una página de usuarios con búsqueda y filtro, menú adaptable y temas claro/oscuro. Los datos son ficticios y las rutas son públicas.

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

- `src/app`: rutas `/` y `/usuarios`, layout y estilos globales.
- `src/components`: navegación, selector de tema y componentes visuales.
- `src/lib/users.ts`: tipos y datos ficticios compartidos entre las dos páginas.

El tema comienza con la preferencia del sistema y guarda la selección del usuario en el navegador.
