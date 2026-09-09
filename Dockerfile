# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

# Keep dependency installation in its own layer so source-only changes reuse it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=forma-pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
