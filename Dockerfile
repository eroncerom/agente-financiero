# ==============================================================================
# Etapa 1: Construcción del Frontend (React + TypeScript + Vite)
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias aprovechando la caché de capas de Docker
COPY package.json package-lock.json ./
RUN npm ci

# Copiar código fuente del frontend y configuraciones de compilación
COPY index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./
COPY src ./src

# Compilar TypeScript y generar bundle estático de producción en /app/dist
RUN npm run build

# ==============================================================================
# Etapa 2: Runtime de Producción (Express + Node 22 SQLite nativo)
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/portfolio.db

# Instalar únicamente dependencias de producción
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el frontend compilado desde la etapa builder
COPY --from=builder /app/dist ./dist

# Copiar el motor cuantitativo y servidor API
COPY server ./server

# Copiar base de datos inicial como semilla si está presente en el contexto (compatible con builds locales y Cloud Git)
COPY package.json portfolio.db* ./

# Crear directorio para el volumen persistente de SQLite
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 3001

# Verificación de salud del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "server/api.mjs"]
