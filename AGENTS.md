# 项目工作约定

## 项目边界

- 本项目是基于 React、TypeScript、Vite、Mantine 和 Ajv 的纯前端 Forma 卡片渲染器，使用 pnpm 管理依赖。
- 只负责把统一的 `CardData` 渲染成卡片，构建产物为 `dist/`。除非任务明确改变范围，不引入后端 API、数据库、队列或截图服务，也不把 Playwright/browserless 加入应用运行时；开发验证可以使用浏览器工具。
- `/` 是正式 Renderer，`/dev` 是 Playground。保持静态 SPA 部署方式，直接访问 `/dev` 需要服务器 fallback 到 `index.html`。
- 本项目 Renderer 渲染出的页面最终应该是完全静态的，不存在任何交互或动态内容

## 代码定位

- `src/types/card.ts`：公共数据类型和浏览器 API 类型。
- `src/schema/`：JSON Schema、默认数据、Schema 注册和 Ajv 运行时校验。
- `src/schema/render-options.json`：所有 Card 共用的主题、水印契约；生成流程把它组合进每个完整 Card Schema。
- `src/fixtures/`：按内容类型组织的示例数据，供默认渲染和 Playground 使用。
- `src/renderer/`：正式页面、渲染状态和浏览器 API；`cards/<type>/` 是每个 Card 的独立实现边界，`Card.tsx` 使用同目录下的 `components/`。
- `src/renderer/frame/`：Renderer 公共外层，负责解析 `options`、设置主题作用域、提供公共主题变量和渲染水印；`FormaRenderer` 统一使用它。
- `src/dev/`：Playground 与 Schema 驱动的表单。
- `src/styles/`：全局、共享卡片基础和 Playground 样式；具体卡片的专属样式放在对应的 `cards/<type>/` 目录。

## 数据与渲染契约

- 新增或调整数据字段时，同步检查 TypeScript 类型、JSON Schema、默认数据、相关 fixture 和渲染组件；公共接口变化同时更新 README。不能仅修改类型而绕过运行时校验。
- 正式页面与 Playground 必须共用 `FormaRenderer` 及各 Card 自己的展示组件；Form 和 JSON 编辑保持同一份 CardData 的双向同步，保留校验错误反馈、可选字段和数组编辑能力。
- 完整 `CardData` 的公共展示参数统一位于可选 `options`；卡片组件接收不含 `options` 的内容类型，单卡 `CardContainer` 只负责卡片表面、布局和尺寸，不处理主题默认值或水印节点。
- 每个 Card 的容器、展示组件和辅助组件必须放在 `cards/<type>/components/`，只由该 Card 使用；不要新增或恢复 `src/renderer/components/` 共享卡片组件目录。跨 Card 的复用需求应先结合具体数据契约和样式边界评估，不通过隐式共享绕过 Card 的独立维护边界。
- 保持 `window.forma.render(data)`、`reset()`、`version` 以及正式页面的 `[data-forma-card]` 节点契约。`render()` 应校验输入，并在 React 更新、字体等待、图片等待及布局稳定检查完成后兑现 Promise；不要改为立即返回。
- 外部文本通过 React 安全渲染，链接保留协议校验，不将输入内容直接作为原始 HTML 注入。

## 修改方式

- 优先沿用现有组件、Schema 和样式组织，不为局部需求新增依赖、框架或抽象层。
- 遵循现有 TypeScript/React 风格和 ESLint、Prettier 配置；避免使用全仓格式化命令顺带修改无关文件。

## 卡片 CSS 规范

- 卡片专属样式必须放在对应的 `cards/<type>/Card.module.css`，由同目录的 `Card.tsx` 导入并通过 `styles.<name>` 使用；模块类名使用语义化的 camelCase。
- `src/styles/renderer.css` 只保留多个卡片或 Renderer 共用的基础样式、主题变量、布局和响应式规则；不要把某一种卡片的布局、关系内容或媒体变体继续加入全局样式。
- 卡片组件需要覆盖基础卡片 DOM 样式时，通过本 Card 的 `CardContainer` 传入模块根类，并在模块中用根类配合 `:global(...)` 限定基础类名的作用域；不要依赖未限定的全局卡片选择器。
- 卡片的断点和状态覆盖放在自己的 CSS Module 中，主题覆盖通过 `RendererFrame` 提供的 CSS 变量；平台差异通过数据和共享语义表达，不为平台复制样式或 Card 实现。
- 删除或重命名 JSX 类名时同步清理无引用的 CSS；不要在 `renderer.css` 或卡片模块中保留当前没有渲染路径的占位样式。
- 非必要不修改覆盖基础卡片样式，保证不同卡片的视觉一致性。
