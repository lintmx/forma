# Forma 项目约定

Forma 将 JSON 数据通过 TypeScript / TSX 模板渲染为 PNG 或 SVG，提供 HTTP API 和 React Playground。

## 按任务查阅

- 新增模板或调整尺寸策略：参见 [开发指南](docs/development.md)，最小实现参考 `src/templates/example/`。
- 修改请求、响应或错误：参见 [API 文档](docs/api.md)，入口为 `src/api/app.ts`。
- 修改排版、字体、图片或 PNG 适配器：参见 [渲染与资源](docs/rendering.md)，实现位于 `src/core/`。
- 修改启动、构建或部署配置：参见 [部署指南](docs/deployment.md)。

公共行为变化时同步对应文档。

## 开发与验证命令

使用 Node.js 22.12+ 和 `package.json` 指定的 pnpm 版本；安装依赖用 `pnpm install --frozen-lockfile`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 API 与 Playground，默认地址为 `http://localhost:3000/dev/` |
| `pnpm check` | Biome 格式、lint、import 排序及 TypeScript 检查 |
| `pnpm exec vitest run tests/<name>.test.ts` | 运行受影响的测试文件 |
| `pnpm test` | 完整 Vitest 测试集 |
| `pnpm test:e2e` | API 与生产模板的 HTTP 图片生成测试，不含浏览器交互 |
| `pnpm build` | 准备字体和 Emoji、检查并构建服务、worker 与 Playground |
| `pnpm preview:typography` | 输出排版样张到 `artifacts/typography/` |

首次单独运行渲染测试前执行 `pnpm fonts:fetch` 和 `pnpm emoji:fetch`；`dev` 和 `build` 已包含这两步。
下载需要网络，已有资源可用 `pnpm fonts:verify` 和 `pnpm emoji:verify` 离线校验。
格式以 `biome.json` 为准，Markdown 不由 Biome 检查。

## 模板与渲染边界

- 生产模板统一在 `src/templates/index.ts` 注册；测试专用模板和 worker 留在 `tests/fixtures/`。
- 模板实现 `Template<T>`，业务字段由 Zod 对象 Schema 定义，字段用 `.describe()` 说明，`mock` 必须通过校验。
  Schema、示例和渲染组件保持一致。
- `render` 只返回内部内容；公共外框、背景、边距、水印由 `src/core/card.tsx` 的 `CardFrame` 负责。
  `watermark` 等通用选项放在请求顶层，不放入模板 `data`。
- 当前管线为 Satori 生成 SVG，PNG 由 Skia Canvas 栅格化后交给 Sharp 编码。
  PNG 固定输出 2×，SVG 保持逻辑尺寸；请求不接受 `scale`。不要将浏览器 CSS 支持范围等同于渲染器能力。
- 复用 `src/core/typography.ts` 的语义排版；等宽内容显式使用 `context.monospaceFontFamily`。
  使用与最终渲染相同的字体和间距测量真实布局，不按字符数估算高度。
- 图片通过模板 `assets` 钩子及传入的 `ImageLoader` 加载，组件从 `context.assets` 读取。
  保留资源校验、下载限制和失败降级，不直接将用户 URL 交给 Satori 或在组件中另行下载。
- 字体二进制不提交 Git；更新字体时同步 `fonts/sources.json` 的来源与哈希，以及相关许可声明。
  运行时使用本地字体，不依赖宿主机字体。

## 界面与文案

以下规则适用于本次任务涉及的 Playground 界面与模板输出，尺寸均指逻辑像素。

- 文案符合受众和场景，清晰简洁、不过于口语化、不随意造词；仅保留理解界面或完成任务所必需的说明。
  不使用中点“·”作为文案分隔符，已有的此类分隔符应移除。
- 按信息优先级组织功能和元素，减少额外判断；必要的选择放在用户原本就打算做选择的位置。
- 注重元素的光学对齐；嵌套容器的内外圆角应结合间距协调，尽量保持同心。
- 需要线条或边框时，使用 `0.5px` 宽度。
- 同一界面或模板的字号不超过 4 种，优先控制在 3 种，最小字号为 `12px`；更多层级通过字重、颜色和间距区分。
- 克制使用圆角、阴影及卡片左侧的彩色装饰线；确需圆角或阴影时，其数值应符合功能场景。

## 改动完成标准

- 代码改动运行 `pnpm check` 和受影响的测试；影响公共渲染链路时扩大到完整测试集。
  纯文档改动仅检查内容、链接和差异，无需下载字体或运行渲染构建。
- 模板、排版或渲染改动检查真实 PNG / SVG 的尺寸与视觉结果，覆盖本次涉及的长文本、多语言或缺图场景；新增 SVG 特性须验证 PNG 适配器兼容性。
  Playground 预览与下载统一使用 `POST /v1/render`，浏览器 DOM 近似图不能替代最终图片验证。
- 构建或 worker 入口改动后验证构建产物及真实 `/healthz`、`/v1/render` 请求。
  服务和 worker 应分别产出 `dist/server.js`、`dist/worker.js`。
- 新增 Playground 静态资源时核对 `src/api/app.ts` 的 `/dev/` 白名单与 MIME 映射，并验证构建后的访问。
- 交付说明已验证的层次（静态、HTTP/worker、图片、浏览器交互）及限制。
