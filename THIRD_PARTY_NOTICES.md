# Third-party assets

Font binaries are downloaded from the pinned upstream sources in
[fonts/sources.json](fonts/sources.json), verified with SHA-256, and included in
the runtime image. Git stores the manifests and licenses, not font binaries.

## Noto Sans CJK

Copyright © 2014–2021 Adobe, with Reserved Font Name Source. Noto is a trademark
of Google Inc. Distributed under the SIL Open Font License 1.1; see
[fonts/OFL.txt](fonts/OFL.txt).

The unmodified Simplified Chinese Regular and Bold OTF files come from
[notofonts/noto-cjk](https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese),
commit `f8d157532fbfaeda587e826d4cd5b21a49186f7c`. Both include Latin, kana and CJK
glyphs; the default Han character forms are Simplified Chinese.

## Inter

Copyright © 2016 The Inter Project Authors. Distributed under the SIL Open Font
License 1.1; see [fonts/Inter-OFL.txt](fonts/Inter-OFL.txt).

The unmodified `Inter-Regular.ttf` and `Inter-Bold.ttf` files are from `extras/ttf`
in the official [Inter 4.1 release](https://github.com/rsms/inter/releases/tag/v4.1),
archive `Inter-4.1.zip`. They are used for body Latin text and numbers.

## Maple Mono CN

Copyright © 2022 The Maple Mono Project Authors. Distributed under the SIL Open
Font License 1.1; see [fonts/MapleMono-OFL.txt](fonts/MapleMono-OFL.txt).

The unmodified `MapleMono-CN-Regular.ttf` and `MapleMono-CN-Bold.ttf` files come
from the official [Maple Mono v7.9 release](https://github.com/subframe7536/maple-font/releases/tag/v7.9),
archive `MapleMono-CN-unhinted.zip`. The CN variant incorporates CJK glyphs based
on Resource Han Rounded. It is the primary monospace font; ASCII and supported
full-width CJK glyphs have 0.6em and 1.2em advances respectively.

## Noto Sans Symbols 2

Copyright © 2022 The Noto Project Authors. Distributed under the SIL Open Font
License 1.1; see [fonts/NotoSansSymbols2-OFL.txt](fonts/NotoSansSymbols2-OFL.txt).

The unmodified `NotoSansSymbols2-Regular.ttf` comes from `NotoSansSymbols2/full/ttf`
in the official [Noto Sans Symbols 2 v2.008 release](https://github.com/notofonts/symbols/releases/tag/NotoSansSymbols2-v2.008).
It is shared as a supplementary symbol fallback and does not guarantee a
monospace grid for those symbols.

## Noto Sans Egyptian Hieroglyphs

Distributed under the SIL Open Font License 1.1; see
[fonts/NotoSansEgyptianHieroglyphs-OFL.txt](fonts/NotoSansEgyptianHieroglyphs-OFL.txt)
for the upstream copyright and license.

The unmodified `NotoSansEgyptianHieroglyphs-Regular.ttf` comes from
`NotoSansEgyptianHieroglyphs/full/ttf` in the official
[Noto Sans Egyptian Hieroglyphs v2.002 release](https://github.com/notofonts/egyptian-hieroglyphs/releases/tag/NotoSansEgyptianHieroglyphs-v2.002),
archive `NotoSansEgyptianHieroglyphs-v2.002.zip`. It is the last fallback for both
body and monospace text, after Noto Sans Symbols 2. It supplies Egyptian
hieroglyphs at weight 400 and does not guarantee a monospace grid.

## Twemoji

Emoji graphics are by Twitter, Inc. and other contributors to
[Twemoji](https://github.com/jdecked/twemoji), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The locally bundled, optimized SVG distribution is `@twemoji/svg@15.0.0`
by Samuel Kopp (package wrapper under MIT; license included in node_modules).
Original artwork is used without further modification; SVG serialization may
be optimized by that distribution. When sharing images containing Twemoji,
retain suitable attribution in accompanying documentation or credits.

Runtime and build dependency licenses remain with their respective packages.
