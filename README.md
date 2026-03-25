# ObraPulse Frontend

Aplicacion web para visualizacion y analisis de datos PAC, construida con React + Vite.

## Resumen

Este frontend permite:

- Visualizar indicadores clave (KPIs) y graficos interactivos.
- Aplicar filtros dinamicos por provincia, ciudad, entidad, tipo de compra y rango de fechas/valores.
- Usar un comparador avanzado con multiples series y distintos tipos de grafica.
- Exportar informacion en CSV, Excel, imagen y PDF.
- Navegar por vistas especializadas: territorial, temporal, reportes, insights, entidad y configuracion.

## Stack Tecnologico

- React 19
- Vite 8
- React Router
- React Query
- Recharts + ECharts
- Axios
- jsPDF + html2canvas + XLSX

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- API backend disponible y accesible por URL publica o local

## Instalacion

```bash
npm install
```

## Configuracion de Entorno

Este proyecto usa variables de entorno de Vite.

1. Crea un archivo `.env` en la raiz del proyecto.
2. Agrega la URL del backend:

```env
VITE_API_URL=http://localhost:8000
```

Si vas a probar con otras personas, usa una URL publica del backend, por ejemplo:

```env
VITE_API_URL=https://tu-backend.onrender.com
```

## Scripts Disponibles

- `npm run dev`: inicia el entorno de desarrollo local.
- `npm run build`: genera el build de produccion en `dist`.
- `npm run preview`: sirve localmente el build generado.
- `npm run lint`: ejecuta validaciones con ESLint.

## Ejecucion en Desarrollo

```bash
npm run dev
```

Abre en el navegador:

```text
http://localhost:5173
```

## Despliegue Recomendado

### Frontend

- Vercel o Netlify.
- Build command: `npm run build`.
- Output directory: `dist`.
- Configurar variable de entorno `VITE_API_URL` en la plataforma de despliegue.

### Backend

- Render, Railway u otra plataforma con URL publica.
- Asegurar CORS habilitado para el dominio del frontend desplegado.

## Estructura Base

```text
src/
	api/               # clientes HTTP y funciones de consulta
	components/        # componentes reutilizables
	context/           # contexto global (tema, etc.)
	pages/             # paginas y vistas principales
	lib/               # utilidades
```

## Notas

- No subir `node_modules` al repositorio.
- Antes de publicar, validar `npm run build` sin errores.
- Verificar conectividad API desde el frontend desplegado.

## Autoria

Desarrollado por William Garzon.
