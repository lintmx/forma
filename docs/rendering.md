# 渲染与资源

[返回 README](../README.md)

## 渲染管线与边界

JSON 经 Zod 校验后，由 TSX 模板生成内容树，Satori 负责布局并输出 SVG。
SVG 请求直接返回该结果；PNG 请求由 Skia Canvas 在 CPU 上栅格化，再交给 Sharp 编码。
文字在 SVG 中转为路径，客户端无需安装字体或运行 React。

PNG 以 4× 布局尺寸采样，用 Lanczos3 缩小到 2×；预乘 RGBA 像素直接交给 Sharp，避免中间 PNG 编解码。
调色板编码参数以 [src/core/png.ts](../src/core/png.ts) 为准。输出宽高、像素数及字节数受
[部署配置](deployment.md) 限制，超限时返回错误。

模板使用 Satori 支持的布局和样式，不具备完整浏览器 CSS 能力。不支持的样式会使渲染失败。
PNG 适配器支持已验证的路径、图形、图片、渐变、pattern、clipPath 和 mask；
`filter`（包括部分 `boxShadow` 输出）、`text`、`use` 和外部资源等不在支持范围内。
内嵌 SVG 支持 base64 / 百分号编码、独立 ID、显式 viewBox 和 image 的 meet/slice/none，
不支持再次嵌套 image、CSS、DTD、循环引用、objectBoundingBox clipPath/maskContentUnits 或隐式 overflow 裁剪。
不兼容的 PNG 渲染通过 `INTERNAL_ERROR` 返回；新增特性需补充兼容验证。

该适配器仅处理内部模板产物，不提供 SVG 上传、模板上传或运行时第三方代码执行。
当前不支持动画、多帧输出或任意布局的双向自适应。

## 通用排版

语义样式集中在 [typography.ts](../src/core/typography.ts)，字号以逻辑像素计，输出倍率不改变布局。
正文为 16px，紧凑内容为 14px，元信息为 12px，标题为 20–28px；使用已加载的 400 / 700 字重。
代码使用等宽字体。测量与最终布局共用字体、换行规则和外框。

普通英文按单词换行，超长词和 URL 可字符级折行，中日文断行交由 Satori 处理。
Markdown 正文使用 GFM 和可见单换行；代码块保留缩进与空行，长行视觉折行，不做语法高亮。
表格最多四列时按内容分配列宽，超过四列转为带列名的记录，以保留全部值。
原始 HTML 不进入渲染树。具体模板支持的数据和格式以其 Schema 为准。

## 默认字体与 Emoji

| 用途 | 字体顺序 |
| --- | --- |
| 正文 | Inter → Noto Sans CJK SC → Noto Sans Symbols 2 → Noto Sans Egyptian Hieroglyphs |
| 等宽 | Maple Mono CN → Noto Sans Symbols 2 → Noto Sans Egyptian Hieroglyphs |

正文与等宽主字体提供 400 / 700 字重，符号字体仅 400。Inter 提供真实斜体与粗斜体；
CJK 和等宽字体没有独立斜体文件，由 Satori 合成。汉字默认采用 SC / Maple CN 字形，不自动切换地区字形。
Maple 未覆盖的部分字符可能回退到正文字体，补充符号和 Emoji 也不保证等宽对齐。

Emoji 使用本地 `@twemoji/svg`，按需读取并缓存。字体与 Emoji 不覆盖全部 Unicode；
无法找到字形时返回 `MISSING_GLYPH`。字体及 Emoji 的版权和署名要求见
[第三方声明](../THIRD_PARTY_NOTICES.md)。

## 字体准备与自定义

[fonts/sources.json](../fonts/sources.json) 固定下载来源和 SHA-256，Git 只保存配置、清单及许可。
`pnpm fonts:fetch` 复用已校验文件，仅下载缺失或损坏的默认字体；校验失败中止。
`pnpm fonts:verify` 只检查本地文件，不联网。更新字体时需同步清单、哈希和许可说明。

`pnpm dev`、`pnpm build` 自动准备默认字体。Docker 构建阶段下载，运行镜像内置字体；
`pnpm start` 和 worker 仅读取本地文件。自定义 `FONT_CONFIG` 引用的文件需自行提供。

`FONT_CONFIG` 指向 JSON 数组，字体路径相对于该配置文件：

```json
[
  { "name": "My Body", "path": "Body-Regular.otf", "weight": 400, "usage": "body" },
  { "name": "My Body", "path": "Body-Bold.otf", "weight": 700, "usage": "body" },
  { "name": "My Mono", "path": "Mono-Regular.ttf", "weight": 400, "usage": "monospace" },
  { "name": "My Symbols", "path": "Symbols.ttf", "weight": 400, "usage": "fallback" }
]
```

最多配置 12 份字体，必须包含正文和等宽用途。`usage` 默认为 `body`，`fallback` 追加到两种用途的末尾；
各用途按配置顺序选择。`style` 默认为 `normal`，可设 `italic`。
使用静态 TTF / OTF / WOFF，不假定 WOFF2、变量字体或所有 OpenType 特性均受支持。
自定义字体需确认覆盖范围和许可。

## 远程图片

仅接受公开 HTTP(S) PNG / JPEG / WebP。统一资源管理器限制下载时间、字节数和解码像素数，
校验并固定 DNS 地址，每次重定向重新验证。私网、回环、链路本地、保留地址、URL 凭据及远程 SVG 被拒绝。
模板获取的是 data URI，Satori 不直接访问用户 URL。

WebP 在校验后转为 PNG，转换结果仍受字节上限约束；PNG / JPEG 保留原始编码。
缓存为每 worker 独立的有界 LRU，最多 128 项，受字节预算和 TTL 限制，同一 worker 合并重复下载。
缓存不持久化，不同 worker 可能分别下载同一 URL。图片加载失败时模板应提供降级内容，API 返回警告头。
