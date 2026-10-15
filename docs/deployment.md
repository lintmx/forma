# 部署指南

[返回 README](../README.md)

## Node.js

需要 Node.js 22.12+ 和 pnpm 10.32.1。在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production pnpm start
```

`pnpm build` 准备字体、运行静态检查，并构建服务、worker 和 Playground。
`pnpm dev` 和 `pnpm start` 自动读取根目录 `.env`，已设置的 shell 环境变量优先；修改后需重启。
生产模式默认关闭 `/dev/`，需要时设置 `PLAYGROUND_ENABLED=true`。

启动会等待 worker 字体加载和 Satori 预热完成。`pnpm start` 不下载字体；离线运行前应准备好
`dist/`、生产依赖、字体配置及字体文件，或使用预先构建的镜像。

## Docker Compose

```sh
docker compose up --build -d
curl --fail http://localhost:3000/healthz
docker compose logs -f forma
docker compose down
```

镜像基于 Node.js 24 / Debian bookworm，采用多阶段构建，内置字体和许可，以非 root 用户运行并提供健康检查。
默认发布到 `127.0.0.1:3000`；通过 `FORMA_BIND`、`FORMA_PORT` 修改宿主机绑定地址和端口。
Compose 的 `.env` 用于变量替换，仅 [compose.yaml](../compose.yaml) 中的 `environment` 条目传入容器；
其他服务变量需自行补充到该配置。

服务不内置鉴权。公开部署时应由反向代理负责访问控制、TLS 和限流。

## 环境变量

可从 [.env.example](../.env.example) 创建本地配置。以下为服务默认值；完整校验范围见
[src/config.ts](../src/config.ts)。

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | 服务监听端口 / 地址 |
| `LOG_LEVEL` | `info` | `silent`、`error`、`info` 或 `debug` |
| `PLAYGROUND_ENABLED` | 非生产 `true` | 是否开放 `/dev/` |
| `RENDER_CONCURRENCY` / `RENDER_QUEUE_LIMIT` | `2` / `16` | worker 数 / 等待队列上限 |
| `RENDER_TIMEOUT_MS` | `30000` | 请求总截止时间，毫秒 |
| `BODY_LIMIT_BYTES` | `65536` | 请求 JSON 字节上限 |
| `MAX_WIDTH` / `MAX_HEIGHT` | `8192` / `32768` | 最终输出宽高上限 |
| `MAX_PIXELS` | `32000000` | 最终输出像素数上限 |
| `MAX_RASTER_PIXELS` | `128000000` | 中间栅格像素数上限，最大可设 `256000000` |
| `MAX_OUTPUT_BYTES` | `67108864` | SVG / PNG 输出字节上限 |
| `IMAGE_TIMEOUT_MS` | `4000` | 单张图片下载总超时，毫秒 |
| `IMAGE_MAX_BYTES` / `IMAGE_MAX_PIXELS` | `5242880` / `16000000` | 图片字节数 / 解码像素数上限 |
| `IMAGE_CACHE_BYTES` / `IMAGE_CACHE_TTL_MS` | `33554432` / `300000` | 每 worker 图片缓存字节预算 / 有效期，毫秒 |
| `FONT_CONFIG` | `fonts/fonts.json` | 字体配置路径 |

## 并发与资源预算

持久 worker 负责布局与栅格化，HTTP 主线程处理请求。总截止时间覆盖正文读取、排队、资源下载和渲染。
超时返回 504；正在工作的 worker 被终止，退出后补建。客户端断开时取消等待任务或回收对应 worker。
服务退出时停止接收请求并关闭 worker。

每个 worker 独立缓存字体和图片，提高并发会增加内存占用。PNG 先以 4× 布局尺寸栅格化，再缩小为 2× 输出；
中间宽高限制是输出宽高限制的两倍，像素总数另受 `MAX_RASTER_PIXELS` 约束。
默认中间像素上限对应的 RGBA 缓冲约 488 MiB，此外还有字体、Canvas、缩放及编码开销。
超限请求会被拒绝，不会自动降低采样倍率。原生调用不能保证立即中断，部署时应同时限制像素数和并发量。

按实际 CPU、内存和负载验证配置。需要检查 worker 生命周期时可运行：

```sh
pnpm build
pnpm exec tsx scripts/verify-skia-workers.ts artifacts/skia-workers.json
```

该脚本使用编译后的 worker，检查并发、连续渲染、取消、超时和重建，并记录进程 RSS。
