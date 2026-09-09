<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->

# Data Comparison

- Card type: `comparison`
- Schema version: `1`
- Description: 对比前后数据并由系统生成指标、文本、逐行差异、实体列表和图片对照；entity 模块直接展示调用方传入的实体列表。

## Fields

| Path                       | Type          | Required | Enum                                        | Default        | Description                                                                                                   |
| -------------------------- | ------------- | -------- | ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`            | const         | Required | —                                           | `"1"`          | —                                                                                                             |
| `type`                     | const         | Required | —                                           | `"comparison"` | —                                                                                                             |
| `title`                    | string        | Required | —                                           | `"数据对比"`   | 卡片主标题，最多显示一行。                                                                                    |
| `subtitle`                 | string        | Optional | —                                           | —              | 可选的卡片副标题，最多显示一行。                                                                              |
| `time`                     | string        | Optional | —                                           | —              | 可选的对比时间或更新时间。                                                                                    |
| `modules`                  | array         | Required | —                                           | —              | 按顺序展示的指标、文本、差异、实体或图片模块。除 entity 列表外，调用方提供 before/after，派生差异由系统计算。 |
| `modules[].type`           | string        | Required | `metric`, `text`, `diff`, `image`, `entity` | `"metric"`     | metric 指标、text 文本、diff 逐行差异、image 图片对照、entity 实体列表变更。                                  |
| `modules[].name`           | string        | Optional | —                                           | —              | 可选的模块标题。                                                                                              |
| `modules[].items`          | array         | Optional | —                                           | —              | metric 模块传入前后数值；entity 模块传入实体、动作文案和颜色。                                                |
| `modules[].items[].label`  | string        | Optional | —                                           | —              | —                                                                                                             |
| `modules[].items[].before` | string,number | Optional | —                                           | `""`           | —                                                                                                             |
| `modules[].items[].after`  | string,number | Optional | —                                           | `""`           | —                                                                                                             |
| `modules[].items[].name`   | string        | Optional | —                                           | —              | —                                                                                                             |
| `modules[].items[].handle` | string        | Optional | —                                           | —              | —                                                                                                             |
| `modules[].items[].bio`    | string        | Optional | —                                           | —              | —                                                                                                             |
| `modules[].items[].action` | string        | Optional | —                                           | —              | 直接显示在实体右侧的动作文案，例如 + 新增关注或 − 取消关注。                                                  |
| `modules[].items[].color`  | string        | Optional | `green`, `red`, `gray`                      | `"gray"`       | —                                                                                                             |
| `modules[].before`         | string,object | Optional | —                                           | —              | text/diff 为文本；image 为图片对象。                                                                          |
| `modules[].before.url`     | string        | Required | —                                           | —              | —                                                                                                             |
| `modules[].before.label`   | string        | Optional | —                                           | —              | —                                                                                                             |
| `modules[].after`          | string,object | Optional | —                                           | —              | text/diff 为文本；image 为图片对象。                                                                          |
| `modules[].after.url`      | string        | Required | —                                           | —              | —                                                                                                             |
| `modules[].after.label`    | string        | Optional | —                                           | —              | —                                                                                                             |
| `options`                  | object        | Optional | —                                           | —              | 适用于所有 Card 的主题、水印和资源地址设置。                                                                  |
| `options.theme`            | string        | Optional | `light`, `dark`                             | `"light"`      | 省略时使用浅色主题。                                                                                          |
| `options.watermark`        | string        | Optional | —                                           | —              | 未传、为空或仅包含空白时不显示。                                                                              |
| `options.assetBaseUrl`     | string        | Optional | —                                           | —              | 用于补全图片和其他媒体相对地址的绝对 http(s) 地址；使用相对资源地址时必须传入。                               |

## Minimal valid example

```json
{
  "schemaVersion": "1",
  "type": "comparison",
  "title": "最小对比示例",
  "modules": [
    {
      "type": "text",
      "before": "旧数据",
      "after": "新数据"
    }
  ]
}
```

## Fixtures

- [Default](./fixtures/default.json)
- [Minimal](./fixtures/minimal.json)
- [Diff](./fixtures/diff.json)
- [Entity](./fixtures/entity.json)
- [Image](./fixtures/image.json)
- [Metric](./fixtures/metric.json)
- [Text](./fixtures/text.json)

The card content schema and fixture files in this directory are the source of truth for Card-specific fields. Shared render options are defined in `src/schema/render-options.json` and composed into the complete contract during generation.
