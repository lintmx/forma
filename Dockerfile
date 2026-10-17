# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS system
# Native Skia/sharp include Fontconfig, but the slim image has no default config.
RUN apt-get update && apt-get install --yes --no-install-recommends fontconfig-config \
    && rm -rf /var/lib/apt/lists/*

FROM system AS base
WORKDIR /app
RUN npm install --global pnpm@10.32.1

FROM base AS build
# Build and production installs share this store; serialize writes to native packages.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=forma-pnpm,target=/pnpm/store,sharing=locked pnpm install --frozen-lockfile --store-dir=/pnpm/store
COPY fonts ./fonts
COPY scripts/font-assets.ts scripts/fetch-fonts.ts ./scripts/
RUN pnpm fonts:fetch
COPY emoji ./emoji
COPY scripts/emoji-assets.ts scripts/fetch-emoji.ts ./scripts/
RUN pnpm emoji:fetch
COPY . .
RUN pnpm build

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=forma-pnpm,target=/pnpm/store,sharing=locked pnpm install --prod --frozen-lockfile --store-dir=/pnpm/store
# Install the build-stage bundles without bringing build tools into production dependencies.
COPY --from=build /app/artifacts/satori /tmp/satori
COPY scripts/build-satori-patch.mjs ./scripts/
RUN node scripts/build-satori-patch.mjs --install-from /tmp/satori

FROM system AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PLAYGROUND_ENABLED=false
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/fonts ./fonts
COPY --from=build /app/emoji ./emoji
COPY --from=build /app/patches ./patches
COPY --from=build /app/package.json /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
