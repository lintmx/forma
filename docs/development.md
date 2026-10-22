# 开发指南

[返回 README](../README.md)

## 项目结构

```text
src/api/          HTTP 路由、请求校验与错误响应
src/core/         外框、排版、渲染、字体、图片和 worker 池
src/templates/    模板实现；index.ts 为生产注册入口
src/server.ts     服务启动与退出
src/worker.ts     生产模板与 worker 的组装入口
playground/       React + Vite 编辑与预览界面
fonts/            字体配置、下载清单与许可证
emoji/            Emoji 下载清单、呈现元数据与许可证
scripts/          构建、开发重启、字体准备与渲染验证
tests/            单元测试、布局及 HTTP/worker 测试
tests/fixtures/   仅供测试使用的模板和 worker 入口
```

`pnpm dev` 让 API 和 Playground 共用端口；服务与模板代码变动会重启服务，前端支持 HMR。
预览和下载都调用真实的 `POST /v1/render`，预览按布局尺寸展示，PNG 下载保留完整 2× 分辨率。

## 模块边界

生产入口通过 `createTemplateRegistry()` 注册模板，HTTP 和 worker 必须使用相同目录。
核心模块负责请求校验、资源加载和渲染，不反向依赖生产模板；业务展示留在模板内。
测试可创建独立注册器，测试模板和 worker 仅放在 `tests/fixtures/`。

请求在入队前校验，worker 接收原始 `data` 后校验并渲染；Schema 的校验与转换应保持纯函数行为。
公共外框、字体及 Emoji 降级由渲染层统一处理，模板不重复实现。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm check` | Biome 格式、lint、import 排序和 TypeScript 检查 |
| `pnpm format` / `pnpm format:check` | 应用格式 / 仅检查格式 |
| `pnpm lint` | 仅运行 lint |
| `pnpm test` | 单元测试及本地 HTTP、worker、图片测试 |
| `pnpm test:e2e` | API 与生产模板的 HTTP 图片生成测试 |
| `pnpm fonts:fetch` / `pnpm fonts:verify` | 下载并校验默认字体 / 仅离线校验 |
| `pnpm emoji:fetch` / `pnpm emoji:verify` | 下载并校验 Emoji / 仅离线校验 |
| `pnpm preview:typography` | 生成排版样张到 `artifacts/typography/` |
| `pnpm build` | 检查并构建生产服务、worker 与 Playground |

首次单独运行测试前执行 `pnpm fonts:fetch` 和 `pnpm emoji:fetch`。代码风格以 [biome.json](../biome.json) 为准。
Markdown 不由 Biome 检查。

## 新增模板

1. 在 `src/templates/<id>/index.tsx` 实现 [Template<T>](../src/core/types.ts)，提供
   `id`、`name`、`description`、Zod 对象 `schema`、`sizing`、`mock` 和 `render`。
2. Schema 只定义业务数据，通过 `.describe()` 说明字段。Schema、组件与示例按复杂度拆分到模板自己的目录。
3. `render` 只返回内部内容。渲染器统一添加 [CardFrame](../src/core/card.tsx)，负责背景、边距、边框、圆角和水印；
   模板不重复包裹外框，也不定义保留字段 `watermark`、`assetUrlPrefix`。
4. 如需远程图片，实现 `assets`，通过传入的 `ImageLoader.get` 获取资源，再从 `context.assets` 读取。
   资源字段复用 `src/core/asset-url.ts` 的 `assetUrlSchema`，请求级加载器自动应用 `assetUrlPrefix`。
   为失败资源提供占位或替代文本，不在组件中直接 `fetch`。
5. 在 [src/templates/index.ts](../src/templates/index.ts) 导入并调用 `.register()`。
   ID 须唯一、以小写字母开头，仅含小写字母、数字、下划线或连字符。
6. 添加相关布局和输出测试，并在 Playground 检查短文、长文、多语言与缺图情况。

最小实现可参考 [example](../src/templates/example/index.tsx)。注册时会校验示例数据；
注册后 API 和 Playground 自动展示模板，无需修改首页文档或增加一份模板字段表。
测试专用模板留在 `tests/fixtures/`，不注册到生产入口。部署前重新构建服务或镜像。

YouTube 模板保留 API 字段结构。普通视频传 `status.publishAt` 表示定时发布，
`status.privacyStatus` 为 `public` / `unlisted` 时按已发布展示；`snippet.publishedAt` 仅用于显示发布日期。
直播通过 `snippet.liveBroadcastContent` 区分预约与直播中，`liveStreamingDetails.actualEndTime` 优先标记结束，
结束后由调用方传 `replayAvailable: true` 确认回放可观看。`observedAt` 仅计算已播时长，计划时间到点不自动切换状态。
频道名最多一行、标题最多两行，超出显示省略号；简介保留前十行，超出以省略标记折叠。

## 尺寸与排版

| `sizing.mode` | 行为与要求 |
| --- | --- |
| `auto-height` | 固定 `width`，由 Satori 计算高度；适合大多数纵向内容 |
| `content` | 通过 `measure` 测量内在宽度，限制于 `minWidth` / `maxWidth`，再计算高度 |
| `fixed` | 固定 `width` / `height`，模板负责内容适配 |
| `auto-width` | 固定 `height`，由内容决定宽度；避免百分比宽度与依赖无限换行的布局 |

尺寸包含统一外框和水印，优先采用 `auto-height` 或 `content`。
`content` 必须提供内部内容的无换行测量树及 `data-measure` 节点，不重复外框边距，也不依赖远程资源。
使用实际字形和布局测量，不按字符数或预估行数计算高度。

统一复用 [typography.ts](../src/core/typography.ts) 的语义字号和换行样式。
正文继承 `context.fontFamily`，代码和等宽数值显式使用 `context.monospaceFontFamily`；
测量树与最终渲染树须保持相同字体、间距和文字角色。采用明确的 Flex 布局与 `boxSizing: border-box`。
支持范围见 [渲染与资源](rendering.md)。

## 验证与提交

提交时说明变更目的、验证结果和已知限制。运行 `pnpm check` 及受影响的测试；
渲染改动应检查真实 PNG / SVG，排版改动可用 `pnpm preview:typography` 查看原始 2×、逻辑尺寸和 390px 宽预览。
关注缺字、长文本换行、图片降级和布局溢出。新增 SVG 特性需补充 PNG 适配器兼容测试。
