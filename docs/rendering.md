# 渲染与资源

[返回 README](../README.md)

## 渲染管线与边界

JSON 经校验后，由 TSX 模板生成内容树，Satori 负责布局并输出 SVG；PNG 由 Skia Canvas 栅格化、Sharp 编码。
SVG 保留逻辑尺寸，PNG 固定输出 2×。文字转为路径，客户端无需安装字体或运行 React。
输出尺寸与资源上限见 [部署配置](deployment.md)。

模板使用 Satori 支持的布局和样式，不具备完整浏览器 CSS 能力。
PNG 适配器支持常用路径、图形、图片、渐变和裁剪，不支持滤镜（含部分阴影）等 SVG 特性。
新增样式或 SVG 特性需验证最终 PNG。
适配器仅处理内部模板产物，不提供 SVG 或模板上传，也不执行用户代码。
当前不支持动画、多帧输出或任意布局的双向自适应。

## 排版

复用 [typography.ts](../src/core/typography.ts) 的语义样式，字号以逻辑像素计。
正文使用 `context.fontFamily`，代码和等宽内容使用 `context.monospaceFontFamily`；
测量与最终渲染须使用相同字体、间距和换行规则。

英文按单词换行，超长词和 URL 可字符级折行。Markdown 支持 GFM 和可见单换行，
代码块保留缩进与空行，长行视觉折行；原始 HTML 不进入渲染树，不做语法高亮。
宽表格转为带列名的记录。具体模板支持的数据和格式以其 Schema 为准。

支持阿拉伯文、希伯来文等 RTL 文字，但双向排版并非完整浏览器实现。
零宽空格仍可作为换行点；字体覆盖不代表任意跨文字系统组合都能正确定位。

## 字体与 Emoji

运行时使用本地字体，不依赖宿主机字体。正文和等宽字体分别配置，共享补充字体回退；
完整配置见 [fonts/fonts.json](../fonts/fonts.json)，不保证覆盖全部 Unicode 或所有回退字形等宽。
汉字默认采用简体字形，不自动切换地区字形；缺少对应字重或斜体时可能由渲染器合成。

Emoji 使用本地 Twemoji 图片；文本与彩色呈现遵循变体选择符及默认呈现规则。
文字缺字、Emoji 或图片不可用时显示占位内容，并通过响应警告头告知调用方，见 [API](api.md#成功响应)。
资源目录缺失、权限等部署错误不会作为普通缺字处理。

字体和 Emoji 的来源、版本与哈希分别维护在 [字体清单](../fonts/sources.json) 和
[Emoji 清单](../emoji/source.json)，许可要求见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
`pnpm dev`、`pnpm build` 自动准备默认资源；单独准备或离线校验的命令见 [开发指南](development.md#常用命令)。
资源文件不提交 Git，更新时同步清单、许可和相关测试。

Satori 在开发、测试和构建前按 [源码补丁](../patches/satori-text-layout.source.patch) 自动重建，
用于修正文字排版及行内 Emoji 问题；也可运行 `pnpm satori:prepare` 手动准备。
升级依赖时需检查补丁并回归验证，运行时不编译。

## 自定义字体

`FONT_CONFIG` 指向字体配置 JSON，文件路径相对于该配置文件：

```json
[
  { "name": "My Body", "path": "Body-Regular.otf", "weight": 400, "usage": "body" },
  { "name": "My Mono", "path": "Mono-Regular.ttf", "weight": 400, "usage": "monospace" }
]
```

最多配置 12 份字体，必须包含正文和等宽用途。`usage` 默认为 `body`，
`fallback` 按配置顺序追加到两种用途末尾；`style` 默认为 `normal`，可设 `italic`。
使用静态 TTF / OTF / WOFF，不假定 WOFF2、变量字体或所有 OpenType 特性均受支持。
自定义字体文件需自行提供，并确认覆盖范围和许可。

## 图片资源

支持 HTTP、HTTPS 和 `file://` 的 PNG / JPEG / WebP 图片，不支持 SVG。
资源由服务端加载，受超时、字节数、解码像素数和重定向次数限制；模板通过 `assets` 钩子获取资源，
不直接下载或将用户 URL 交给 Satori。加载失败时应提供占位或替代内容。

请求顶层的 `assetUrlPrefix` 可补全头像、媒体及 Markdown 图片的相对路径，见
[API 资源 URL 前缀](api.md#资源-url-前缀)。`localhost` 和本地文件路径均相对于服务所在主机或容器，
本地文件访问使用服务进程的权限。

图片缓存按 worker 独立管理，受容量和有效期限制，不持久化。
相同资源可复用缓存，但不同 worker 可能分别下载。
