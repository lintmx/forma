<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->

# Social Post

- Card type: `social_post`
- Schema version: `1`
- Description: 跨平台社交内容的统一表现形式。

## Fields

| Path                                      | Type    | Required | Enum                                | Default         | Description                                                                                                                                      |
| ----------------------------------------- | ------- | -------- | ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`                           | const   | Required | —                                   | `"1"`           | Forma Card 协议版本。                                                                                                                            |
| `type`                                    | const   | Required | —                                   | `"social_post"` | Card 的唯一类型标识。                                                                                                                            |
| `author`                                  | object  | Optional | —                                   | —               | 当前社交内容的作者。                                                                                                                             |
| `author.name`                             | string  | Optional | —                                   | `"未命名作者"`  | 作者显示名称。                                                                                                                                   |
| `author.handle`                           | string  | Optional | —                                   | —               | 可选的公开账号标识。                                                                                                                             |
| `author.avatarUrl`                        | string  | Optional | —                                   | —               | 用于渲染作者头像的图片地址。                                                                                                                     |
| `author.verified`                         | boolean | Optional | —                                   | `false`         | 是否显示认证标记。                                                                                                                               |
| `source`                                  | string  | Optional | —                                   | —               | Footer 中展示的来源名称。                                                                                                                        |
| `url`                                     | string  | Optional | —                                   | —               | 显示在卡片底部的原文链接，作为普通文本展示。                                                                                                     |
| `postKind`                                | string  | Optional | `post`, `reply`, `quote`, `reshare` | `"post"`        | 描述普通内容、回复、引用或转发关系。                                                                                                             |
| `content`                                 | string  | Optional | —                                   | —               | 社交内容正文，可为空以支持纯媒体内容。                                                                                                           |
| `translation`                             | object  | Optional | —                                   | —               | 当前内容的翻译结果。                                                                                                                             |
| `translation.text`                        | string  | Required | —                                   | —               | 翻译后的文本。                                                                                                                                   |
| `translation.sourceLanguage`              | string  | Optional | —                                   | —               | 原文语言名称。                                                                                                                                   |
| `translation.model`                       | string  | Optional | —                                   | —               | 翻译所使用的模型名称。                                                                                                                           |
| `media`                                   | array   | Optional | —                                   | —               | 按顺序展示的图片、视频、GIF 或音频预览。                                                                                                         |
| `media[].type`                            | string  | Optional | `image`, `video`, `gif`, `audio`    | `"image"`       | 决定媒体预览上的标记。                                                                                                                           |
| `media[].url`                             | string  | Required | —                                   | —               | 媒体原始地址。                                                                                                                                   |
| `media[].previewUrl`                      | string  | Optional | —                                   | —               | 视频、GIF 或音频可选的预览图地址。                                                                                                               |
| `media[].alt`                             | string  | Optional | —                                   | —               | 图片的无障碍描述。                                                                                                                               |
| `mediaLayout`                             | string  | Optional | `vertical`, `grid`, `collage`       | `"vertical"`    | vertical 为按原比例完整竖排；grid 按媒体数量自动采用单图、左右、一大两小、2×2 或三列宫格，缩略图统一裁切；collage 为横向完整排列且中间不留缝隙。 |
| `replyChain`                              | array   | Optional | —                                   | —               | 回复内容上下文，渲染时最多显示最近九条。                                                                                                         |
| `replyChain[].author`                     | object  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].author.name`                | string  | Optional | —                                   | `"未命名作者"`  | —                                                                                                                                                |
| `replyChain[].author.handle`              | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].author.avatarUrl`           | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].author.verified`            | boolean | Optional | —                                   | `false`         | —                                                                                                                                                |
| `replyChain[].content`                    | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].translation`                | object  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].translation.text`           | string  | Required | —                                   | —               | —                                                                                                                                                |
| `replyChain[].translation.sourceLanguage` | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].translation.model`          | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].media`                      | array   | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].media[].type`               | string  | Optional | `image`, `video`, `gif`, `audio`    | `"image"`       | —                                                                                                                                                |
| `replyChain[].media[].url`                | string  | Required | —                                   | —               | —                                                                                                                                                |
| `replyChain[].media[].previewUrl`         | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].media[].alt`                | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `replyChain[].publishedAt`                | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost`                              | object  | Optional | —                                   | —               | 被当前内容引用的社交内容。                                                                                                                       |
| `quotedPost.author`                       | object  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.author.name`                  | string  | Optional | —                                   | `"未命名作者"`  | —                                                                                                                                                |
| `quotedPost.author.handle`                | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.author.avatarUrl`             | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.author.verified`              | boolean | Optional | —                                   | `false`         | —                                                                                                                                                |
| `quotedPost.content`                      | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.translation`                  | object  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.translation.text`             | string  | Required | —                                   | —               | —                                                                                                                                                |
| `quotedPost.translation.sourceLanguage`   | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.translation.model`            | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.media`                        | array   | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.media[].type`                 | string  | Optional | `image`, `video`, `gif`, `audio`    | `"image"`       | —                                                                                                                                                |
| `quotedPost.media[].url`                  | string  | Required | —                                   | —               | —                                                                                                                                                |
| `quotedPost.media[].previewUrl`           | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.media[].alt`                  | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `quotedPost.publishedAt`                  | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `reshare`                                 | object  | Optional | —                                   | —               | 描述转发当前内容的账号。                                                                                                                         |
| `reshare.by`                              | object  | Required | —                                   | —               | —                                                                                                                                                |
| `reshare.by.name`                         | string  | Required | —                                   | `"未命名作者"`  | —                                                                                                                                                |
| `reshare.publishedAt`                     | string  | Optional | —                                   | —               | —                                                                                                                                                |
| `publishedAt`                             | string  | Optional | —                                   | —               | 当前内容的显示时间。                                                                                                                             |
| `options`                                 | object  | Optional | —                                   | —               | 适用于所有 Card 的主题、背景、水印和资源地址设置。                                                                                               |
| `options.theme`                           | string  | Optional | `light`, `dark`                     | `"light"`       | 省略时使用浅色主题。                                                                                                                             |
| `options.transparentBackground`           | boolean | Optional | —                                   | `false`         | 设置为 true 时使用透明背景；省略或设置为 false 时使用主题背景。                                                                                  |
| `options.watermark`                       | string  | Optional | —                                   | —               | 未传、为空或仅包含空白时不显示。                                                                                                                 |
| `options.assetBaseUrl`                    | string  | Optional | —                                   | —               | 用于补全图片和其他媒体相对地址的绝对 http(s) 地址；使用相对资源地址时必须传入。                                                                  |

## Minimal valid example

```json
{
  "schemaVersion": "1",
  "type": "social_post",
  "content": "这是一条只有必填字段的内容。"
}
```

## Fixtures

- [Default](./fixtures/default.json)
- [Minimal](./fixtures/minimal.json)
- [Long Text](./fixtures/long-text.json)
- [Media Collage](./fixtures/media-collage.json)
- [Media Only](./fixtures/media-only.json)
- [Multi Image](./fixtures/multi-image.json)
- [Relations](./fixtures/relations.json)
- [Reply](./fixtures/reply.json)
- [Reshare](./fixtures/reshare.json)
- [Translated](./fixtures/translated.json)

The card content schema and fixture files in this directory are the source of truth for Card-specific fields. Shared render options are defined in `src/schema/render-options.json` and composed into the complete contract during generation.
