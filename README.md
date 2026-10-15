# Forma

基于 TypeScript 和 TSX 模板的卡片渲染服务，将 JSON 数据转换为 PNG 或 SVG，适用于消息卡片、内容分享和数据展示。

- **Schema 驱动**：通过 Zod 校验数据，模板 API 提供字段定义和示例。
- **无需浏览器**：使用 Satori、Skia Canvas 和 Sharp 渲染，支持本地字体与 Emoji。
- **即时预览**：内置 Playground，预览与下载使用同一渲染 API。
- **独立部署**：支持 Node.js 和 Docker，无需数据库或 Redis。

## 快速开始

需要 Node.js 22.12+ 和 pnpm 10.32.1。在仓库根目录运行：

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

打开 [Playground](http://localhost:3000/dev/)，选择模板、编辑 JSON 并下载图片。
首次启动会从上游 GitHub 下载并校验字体和 Emoji；后续启动复用本地文件。
可参考 [.env.example](.env.example) 创建 `.env`，调整端口等配置。

## 渲染图片

```sh
curl --fail-with-body http://localhost:3000/v1/render \
  -H 'Content-Type: application/json' \
  --data '{"template":"example","data":{"text":"你好，世界。\nHello, Forma."},"format":"png"}' \
  --output example.png
```

接口直接返回图片二进制。PNG 固定为 2× 输出；将 `format` 改为 `svg` 可获取原始布局尺寸的矢量图。
可选的 `watermark` 放在请求顶层，`data` 只包含模板业务数据。

通过 `GET /v1/templates` 查看可用模板、Schema 和示例；具体字段也可在 Playground 中查看。
完整请求、响应和错误说明见 [API 文档](docs/api.md)。

## 部署

```sh
docker compose up --build -d
curl --fail http://localhost:3000/healthz
```

Compose 默认绑定 `127.0.0.1:3000`，生产模式默认关闭 Playground。
服务不内置鉴权，对外提供访问时需在反向代理层配置访问控制和限流。
Node.js 部署、环境变量和资源预算见 [部署指南](docs/deployment.md)。

## 开发与贡献

新增模板从 [模板开发指南](docs/development.md) 开始。提交变更前运行 `pnpm check` 和相关测试；
涉及排版时，使用 Playground 检查真实输出。问题反馈请附最小请求、运行环境和预期结果。

## 文档

| 文档 | 内容 |
| --- | --- |
| [API](docs/api.md) | 请求格式、模板发现、响应头、错误处理 |
| [部署指南](docs/deployment.md) | Node.js、Docker、环境变量与并发配置 |
| [开发指南](docs/development.md) | 项目结构、模板注册、尺寸策略与验证 |
| [渲染与资源](docs/rendering.md) | 渲染边界、排版、字体、Emoji 与图片加载 |

## 许可证

项目代码采用 [MIT 许可证](LICENSE)。字体和 Emoji 仍适用各自的许可，版权及署名要求见
[第三方声明](THIRD_PARTY_NOTICES.md)。
