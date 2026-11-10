# 部署指南

[返回 README](../README.md)

## Node.js

需要 Node.js 22.12+，pnpm 版本以 [package.json](../package.json) 的 `packageManager` 为准。在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production pnpm start
```

`pnpm build` 准备字体和 Emoji，运行静态检查，输出 `dist/server.js`、`dist/worker.js` 和 `dist/playground/`。
`pnpm dev` 和 `pnpm start` 自动读取根目录 `.env`，已设置的 shell 环境变量优先；修改后需重启。
生产模式默认关闭 `/dev/`，需要时设置 `PLAYGROUND_ENABLED=true`。

启动会等待渲染子进程字体加载和 Takumi 预热完成。`pnpm start` 不下载字体或 Emoji；离线运行前应准备好
`dist/`、生产依赖、字体配置及字体文件、`emoji/svg/`、`licenses/` 和根目录许可声明，或使用预先构建的镜像。
可用 `pnpm fonts:verify` 和 `pnpm emoji:verify` 离线检查资源完整性。

## Docker Compose

```sh
docker compose up --build -d
curl --fail http://localhost:3000/healthz
docker compose logs -f forma
docker compose down
```

镜像基于 Node.js 24 / Debian bookworm，采用多阶段构建，内置字体、Emoji 和许可，以非 root 用户运行并提供健康检查。
默认发布到 `127.0.0.1:3000`；通过 `FORMA_BIND`、`FORMA_PORT` 修改宿主机绑定地址和端口。
Compose 的 `.env` 用于变量替换，仅 [compose.yaml](../compose.yaml) 中的 `environment` 条目传入容器；
其他服务变量需自行补充到该配置。

服务不内置鉴权。公开部署时应由反向代理负责访问控制、TLS 和限流。

## GHCR 自动构建

[GitHub Actions workflow](../.github/workflows/docker-publish.yml) 在推送 `master` 时使用根目录 `Dockerfile`
构建 `linux/amd64` 镜像，当前仓库发布到 `ghcr.io/lintmx/forma:latest`。

发布使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需额外配置登录 Secret。
镜像的公开或私有可见性由 GHCR 包设置控制。

```sh
docker pull ghcr.io/lintmx/forma:latest
docker run --rm -p 127.0.0.1:3000:3000 ghcr.io/lintmx/forma:latest
```

## 环境变量

可从 [.env.example](../.env.example) 创建本地配置。以下为服务默认值；完整校验范围见
[src/config.ts](../src/config.ts)。

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | 服务监听端口 / 地址 |
| `LOG_LEVEL` | `info` | `silent`、`error`、`info` 或 `debug` |
| `PLAYGROUND_ENABLED` | 生产 `false`，其他 `true` | 是否开放 `/dev/`，生产环境指 `NODE_ENV=production` |
| `RENDER_CONCURRENCY` / `RENDER_QUEUE_LIMIT` | `2` / `16` | worker 数 / 等待队列上限 |
| `RENDER_TIMEOUT_MS` | `30000` | 请求总截止时间，毫秒 |
| `BODY_LIMIT_BYTES` | `65536` | JSON 请求或 multipart 中 `request` 字段的字节上限 |
| `MULTIPART_BODY_LIMIT_BYTES` | `20971520` | multipart 整体字节上限，包含字段和协议开销，最大 80 MiB |
| `UPLOAD_MAX_FILES` | `16` | 单次上传文件数上限，最大 64 |
| `MAX_WIDTH` / `MAX_HEIGHT` | `8192` / `32768` | 最终输出宽高上限 |
| `MAX_PIXELS` | `32000000` | 最终输出像素数上限 |
| `MAX_OUTPUT_BYTES` | `67108864` | PNG 输出字节上限 |
| `IMAGE_TIMEOUT_MS` | `4000` | 单张图片下载总超时，毫秒 |
| `IMAGE_MAX_BYTES` / `IMAGE_MAX_PIXELS` | `5242880` / `16000000` | 单张图片字节数 / 解码像素数上限，适用于下载与上传 |
| `IMAGE_CACHE_BYTES` / `IMAGE_CACHE_TTL_MS` | `33554432` / `300000` | 每 worker 图片缓存字节预算 / 有效期，毫秒 |
| `FONT_CONFIG` | `fonts/fonts.json` | 字体配置路径 |

## 并发与资源预算

持久 Node.js 子进程负责渲染，HTTP 主进程处理请求。请求截止时间覆盖读取、排队、资源下载和渲染；
超时返回 504；正在执行的取消、超时或关闭会终止对应子进程，等待实际退出后才恢复容量。
排队任务取消只移出队列，服务关闭时等待所有执行单元退出。

每个 worker 独立缓存字体和图片，提高并发会增加内存占用。
Takumi 直接编码高清 PNG；旧的 `MAX_RASTER_PIXELS` 已移除，部署时删除该配置。
原始图片缓存默认每进程 32 MiB，Takumi 资源缓存另有 32 MiB，字形缓存为 8 MiB；字体、画布和进程开销另计。
监控内存时累加主进程和所有渲染子进程 RSS，不能仅使用主进程内存。
超限请求会被拒绝，不会自动降低采样倍率；按实际 CPU、内存和负载调整配置。
本次 macOS 验收中，默认并发 2、980 次预设混合请求的进程树峰值 RSS 约 900 MiB；
该值包含测试驱动，不是生产内存保证。部署前应使用实际图片和上传负载确认余量。

上传附件驻留内存，并发上传、排队及渲染的 multipart 请求总数受 worker 数量加队列容量限制。
容量规划需同时考虑 multipart 上限、队列容量和图片解码内存；代理的请求体大小和超时配置应与服务匹配。
