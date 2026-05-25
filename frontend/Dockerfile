# syntax=docker/dockerfile:1
# Build static assets (VITE_* baked at build time for browser).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=
ARG VITE_API_PREFIX=/api/v1
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_PREFIX=$VITE_API_PREFIX

RUN npm run build

# Official unprivileged nginx (non-root, listens on 8080).
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER root
RUN apk add --no-cache wget

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
