<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->

# Forma Contract

Schema Version: `1`

## Shared Render Options

All Cards accept the optional `options` object. The omitted theme defaults to `light`; a missing, empty, or whitespace-only watermark is not rendered; `assetBaseUrl` resolves relative image and media URLs.

| Path                   | Type   | Required | Enum            | Default   | Description                                                                     |
| ---------------------- | ------ | -------- | --------------- | --------- | ------------------------------------------------------------------------------- |
| `options.theme`        | string | Optional | `light`, `dark` | `"light"` | 省略时使用浅色主题。                                                            |
| `options.watermark`    | string | Optional | —               | —         | 未传、为空或仅包含空白时不显示。                                                |
| `options.assetBaseUrl` | string | Optional | —               | —         | 用于补全图片和其他媒体相对地址的绝对 http(s) 地址；使用相对资源地址时必须传入。 |

## Cards

- [Data Comparison](./cards/comparison/README.md)
- [Social Post](./cards/social_post/README.md)
