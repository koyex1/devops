# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime (thin) ----
FROM nginx:1.27-alpine AS runner

# Replace default nginx static config (optional but recommended)
# - SPA fallback
# - cache headers
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]