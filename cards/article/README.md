<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->

# Article

- Card type: `article`
- Schema version: `1`
- Description: 跨平台长文内容的统一表现形式。

## Fields

| Path                            | Type    | Required | Enum               | Default        | Description                                                                     |
| ------------------------------- | ------- | -------- | ------------------ | -------------- | ------------------------------------------------------------------------------- |
| `schemaVersion`                 | const   | Required | —                  | `"1"`          | Forma Card 协议版本。                                                           |
| `type`                          | const   | Required | —                  | `"article"`    | Card 的唯一类型标识。                                                           |
| `title`                         | string  | Optional | —                  | —              | 文章标题，省略时不渲染标题区域。                                                |
| `time`                          | string  | Optional | —                  | —              | 文章的显示时间，原样展示。                                                      |
| `author`                        | object  | Optional | —                  | —              | 文章作者信息。                                                                  |
| `author.name`                   | string  | Optional | —                  | `"未命名作者"` | 作者显示名称。                                                                  |
| `contentType`                   | string  | Optional | `markdown`, `text` | `"markdown"`   | 正文的渲染类型；省略时按 Markdown 渲染。                                        |
| `content`                       | string  | Required | —                  | —              | 文章正文；Markdown 类型支持语法渲染，文本类型按纯文本保留换行。                 |
| `translation`                   | object  | Optional | —                  | —              | 文章标题和正文的翻译结果；正文类型省略时按 Markdown 语法渲染。                  |
| `translation.contentType`       | string  | Optional | `markdown`, `text` | `"markdown"`   | 正文译文的渲染类型；省略时按 Markdown 渲染。                                    |
| `translation.title`             | string  | Optional | —                  | —              | 翻译后的标题。                                                                  |
| `translation.content`           | string  | Optional | —                  | —              | 翻译后的正文；Markdown 类型支持语法渲染，文本类型按纯文本保留换行。             |
| `translation.sourceLanguage`    | string  | Optional | —                  | —              | 原文语言名称。                                                                  |
| `translation.model`             | string  | Optional | —                  | —              | 翻译所使用的模型名称。                                                          |
| `source`                        | string  | Optional | —                  | —              | Footer 中展示的来源名称。                                                       |
| `url`                           | string  | Optional | —                  | —              | 显示在卡片底部的原文链接，作为普通文本展示。                                    |
| `options`                       | object  | Optional | —                  | —              | 适用于所有 Card 的主题、背景、水印和资源地址设置。                              |
| `options.theme`                 | string  | Optional | `light`, `dark`    | `"light"`      | 省略时使用浅色主题。                                                            |
| `options.transparentBackground` | boolean | Optional | —                  | `false`        | 设置为 true 时使用透明背景；省略或设置为 false 时使用主题背景。                 |
| `options.watermark`             | string  | Optional | —                  | —              | 未传、为空或仅包含空白时不显示。                                                |
| `options.assetBaseUrl`          | string  | Optional | —                  | —              | 用于补全图片和其他媒体相对地址的绝对 http(s) 地址；使用相对资源地址时必须传入。 |

## Minimal valid example

```json
{
  "schemaVersion": "1",
  "type": "article",
  "content": "这是一篇只有必填正文的文章。"
}
```

## Fixtures

- [Default](./fixtures/default.json)
- [Minimal](./fixtures/minimal.json)
- [Long Text](./fixtures/long-text.json)
- [Markdown](./fixtures/markdown.json)
- [Plain Text](./fixtures/plain-text.json)
- [Relative Media](./fixtures/relative-media.json)
- [Translated](./fixtures/translated.json)

The card content schema and fixture files in this directory are the source of truth for Card-specific fields. Shared render options are defined in `src/schema/render-options.json` and composed into the complete contract during generation.
