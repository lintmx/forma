# 渲染与资源

[返回 README](../README.md)

## 渲染管线与边界

JSON 经校验后，由 TSX 模板生成内容树，经 `fromJsx` 转换后由 Takumi 2.20.0 完成布局、绘制和 PNG 编码。
输出高清 PNG，客户端无需安装字体或运行 React。输出尺寸与资源上限见 [部署配置](deployment.md)。

只提供 PNG 输出；SVG 仅用于模板内可信图标和本地 Twemoji，不接受 SVG 上传或用户自定义模板。
样式以锁定版本的 Takumi 支持范围为准，不等同于完整浏览器；新增布局或图标必须验证最终 PNG。
当前不提供动画、多帧输出或任意布局的双向自适应。

每个执行单元是持久 Node.js 子进程，独立注册字体并预热 Renderer；超时或取消时终止子进程，
等待退出后补建，避免原生渲染继续占用已释放的容量。进程间以二进制 IPC 传输附件和 PNG。

## 排版

复用 [typography.ts](../src/core/typography.ts) 的语义样式，字号以逻辑像素计。
正文使用 `context.fontFamily`，代码和等宽内容使用 `context.monospaceFontFamily`；
测量与最终渲染须使用相同字体、间距和换行规则。尺寸策略见[开发指南](development.md#尺寸与排版)。

英文按单词换行，超长词和 URL 可字符级折行。Markdown 支持 GFM 和可见单换行，
代码块保留缩进与空行，长行视觉折行；原始 HTML 不进入渲染树，不做语法高亮。
表格使用原生 table，按实际布局宽度超限时转换一次带列名的记录；代码行号使用 Grid 固有列宽。具体模板支持的数据和格式以其 Schema 为准。

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

缺字诊断使用 Takumi 的按需字体加载：在完整的已配置字体回退链之后放置请求级探测字体，
仅在引擎实际匹配不到可见字符时加载并记录 `MISSING_GLYPH`。控制字符、空白和默认可忽略字符
不触发探测。请求结束注销探测字体；不会使用独立 cmap 估计代替引擎的匹配结果。

## 自定义字体

`FONT_CONFIG` 指向字体配置 JSON，文件路径相对于该配置文件：

```json
[
  { "name": "My Body", "path": "Body-Regular.otf", "weight": 400, "usage": "body" },
  { "name": "My Mono", "path": "Mono-Regular.ttf", "weight": 400, "usage": "monospace" }
]
```

最多配置 12 份字体，必须包含正文和等宽用途。`usage` 默认为 `body`，
`fallback` 按配置顺序追加到两种用途末尾，其余已配置字体作为最终回退；`style` 默认为 `normal`，可设 `italic`。
使用静态 TTF / OTF / WOFF，不假定 WOFF2、变量字体或所有 OpenType 特性均受支持。
自定义字体文件需自行提供，并确认覆盖范围和许可。

## 图片资源

支持 PNG、JPEG、WebP，不支持 SVG 输入。三种格式均校验完整解码内容后以原始二进制交给 Takumi，WebP 无需转码。
模板通过 `assets` 钩子和请求级 `ImageLoader.get()` 加载资源，组件只读取 `context.assets` 中资源的 `src`、`width`、`height`，
不自行下载或将用户 URL 交给 Takumi；加载失败时提供占位或替代内容。

HTTP(S) 和 `file://` 资源由服务端加载，受超时、字节数、解码像素数和重定向次数限制，
按 worker 独立缓存并受容量和有效期限制，不持久化；不同 worker 可能分别下载。
`localhost` 和本地文件路径相对于服务所在主机或容器，本地文件访问使用服务进程的权限。

同一加载器处理 `assetUrlPrefix` 相对路径补全和 `asset:id` 附件引用。附件在 worker 内校验并解码，
仅在当前请求内复用，不进入跨请求缓存，Takumi 解码缓存也使用 `cache: "none"`。调用规则见 [资源 URL 前缀](api.md#资源-url-前缀)及[随请求上传图片](api.md#随请求上传图片)。

## 缓存与尺寸

下载资源缓存按实际二进制字节计费，默认每进程 32 MiB、128 项和 5 分钟 TTL；资源名由内容哈希生成。
Takumi 解码图片、SVG 和样式缓存另设每进程 32 MiB，字形缓存 8 MiB；注册的本地字体常驻。
这些数值不是总 RSS 上限，还需考虑画布、原生布局、字体与 IPC 临时内存。

测量结果按 DPR 2 获取，向上取整到逻辑像素后再绘制，返回偶数设备像素尺寸。
最终画布的宽高和像素数在绘制前校验，编码后核对 PNG 实际尺寸及输出字节限制。
不再建立 4× 中间栅格，Sharp 仅用于输入图片校验。
