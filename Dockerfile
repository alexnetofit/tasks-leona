# ===========================================================
# Leona Projetos — Multi-stage Dockerfile para Easypanel
# ===========================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json ./

# Install deps
RUN npm ci --legacy-peer-deps

# Copiar código fonte (NÃO inclui .env — passe via --build-arg ou build env)
COPY . .

# Build (variáveis VITE_* devem vir do ambiente do build, nunca do .env do repo)
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

# Healthcheck usando curl (disponível no nginx:alpine)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
