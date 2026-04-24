# ===========================================================
# Leona Projetos — Multi-stage Dockerfile para Easypanel
# ===========================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Build args para variáveis Vite (injetadas no build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME="Leona Projetos"

# Copiar package files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci --legacy-peer-deps

# Copiar código fonte
COPY . .

# Build
RUN npm run build

# Stage 2: Serve com Nginx
FROM nginx:alpine AS runner

# Remover config padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copiar config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build do stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
