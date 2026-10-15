# Forma 项目约定

Forma 将 JSON 数据通过 TypeScript / TSX 模板渲染为 PNG 或 SVG，提供 HTTP API 和 React Playground。
本文件仅记录项目特有的开发约束；任务范围和协作方式遵循用户要求及全局约定。

## 按任务查阅

- 新增模板或调整尺寸策略：参见 [开发指南](docs/development.md)，最小实现参考 `src/templates/example/`。
- 修改请求、响应或错误：参见 [API 文档](docs/api.md)，入口为 `src/api/app.ts`。
- 修改排版、字体、图片或 PNG 适配器：参见 [渲染与资源](docs/rendering.md)，实现位于 `src/core/`。
- 修改启动、构建或部署配置：参见 [部署指南](docs/deployment.md)。

按任务读取相关章节，无需在每次修改前通读全部文档。公共行为变化时同步对应文档。

## 开发与验证命令

使用 Node.js 22.12+ 和 `package.json` 指定的 pnpm 版本；安装依赖用 `pnpm install --frozen-lockfile`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 API 与 Playground，默认地址为 `http://localhost:3000/dev/` |
| `pnpm check` | Biome 格式、lint、import 排序及 TypeScript 检查 |
| `pnpm exec vitest run tests/<name>.test.ts` | 运行受影响的测试文件 |
| `pnpm test` | 完整 Vitest 测试集 |
| `pnpm test:e2e` | API 与生产模板的 HTTP 图片生成测试，不含浏览器交互 |
| `pnpm build` | 准备字体、检查并构建服务、worker 与 Playground |
| `pnpm preview:typography` | 输出排版样张到 `artifacts/typography/` |

首次单独运行渲染测试前执行 `pnpm fonts:fetch`；`dev` 和 `build` 已包含此步骤。
下载需要网络，已有字体可用 `pnpm fonts:verify` 离线校验。格式以 `biome.json` 为准，Markdown 不由 Biome 检查。

## 模板与渲染边界

- 生产模板统一在 `src/templates/index.ts` 注册；测试专用模板和 worker 留在 `tests/fixtures/`。
- 模板实现 `Template<T>`，业务字段由 Zod 对象 Schema 定义，字段用 `.describe()` 说明，`mock` 必须通过校验。
  注册器会严格校验数据；Schema、示例和渲染组件变更应保持一致。
- 模板的 `render` 只返回内部内容。公共外框、背景、边距、水印由 `src/core/card.tsx` 的 `CardFrame` 负责。
  `watermark` 等通用渲染选项属于请求顶层，不放入模板 `data`。
- 当前管线为 Satori 生成 SVG，PNG 由 Skia Canvas 栅格化后交给 Sharp 编码。
  PNG 固定输出 2×，SVG 保持逻辑尺寸；请求不接受 `scale`。不要将浏览器 CSS 支持范围等同于渲染器能力。
- 复用 `src/core/typography.ts` 的语义排版；等宽内容显式使用 `context.monospaceFontFamily`。
  测量与最终渲染保持相同字体和间距，用真实布局测量尺寸，不按字符数估算高度。
- 远程图片通过模板 `assets` 钩子及传入的 `ImageStore` 加载，组件从 `context.assets` 读取。
  保留资源校验、下载限制和失败降级，不直接将用户 URL 交给 Satori 或在组件中另行下载。
- 字体二进制不提交 Git；更新字体时同步 `fonts/sources.json` 的来源与哈希，以及相关许可声明。
  运行时使用本地字体，不依赖宿主机字体。

## 改动完成标准

- 代码改动运行 `pnpm check` 和受影响的测试；影响公共渲染链路时扩大到完整测试集。
  纯文档改动检查内容、链接和差异即可，无需触发字体下载或渲染构建。
- 模板、排版或渲染改动检查真实 PNG / SVG 的尺寸与视觉结果，覆盖本次改动相关的长文本、多语言或缺图场景。
  Playground 预览与下载使用同一 `POST /v1/render`；浏览器 DOM 近似图不能替代最终图片验证。
- 新增 SVG 特性时验证 PNG 适配器兼容性；不能仅凭 SVG 能显示就判定 PNG 支持。
- 构建或 worker 入口改动后验证构建产物及真实 `/healthz`、`/v1/render` 请求。
  服务和 worker 应分别产出 `dist/server.js`、`dist/worker.js`。
- 新增 Playground 静态资源时核对 `src/api/app.ts` 的 `/dev/` 白名单与 MIME 映射，并验证构建后的访问。
- 交付时说明已执行的检查及限制，区分静态检查、HTTP/worker 测试、图片检查和浏览器交互验证。
