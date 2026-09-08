<!-- AUTO-GENERATED. DO NOT EDIT. Run pnpm generate. -->

# Forma Contract

Schema Version: `1`

## Shared Render Options

All Cards accept the optional `options` object. The omitted theme defaults to `light`; a missing, empty, or whitespace-only watermark is not rendered.

| Path                | Type   | Required | Enum            | Default   | Description                      |
| ------------------- | ------ | -------- | --------------- | --------- | -------------------------------- |
| `options.theme`     | string | Optional | `light`, `dark` | `"light"` | 省略时使用浅色主题。             |
| `options.watermark` | string | Optional | —               | —         | 未传、为空或仅包含空白时不显示。 |

## Cards

- [Social Post](./cards/social_post/README.md)
