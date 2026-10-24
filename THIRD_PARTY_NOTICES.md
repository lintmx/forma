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

The unmodified `Inter-Regular.ttf`, `Inter-Bold.ttf`, `Inter-Italic.ttf` and
`Inter-BoldItalic.ttf` files are from `extras/ttf`
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
archive `NotoSansEgyptianHieroglyphs-v2.002.zip`. It is a fallback for both
body and monospace text, after Noto Sans Symbols 2. It supplies Egyptian
hieroglyphs at weight 400 and does not guarantee a monospace grid.

## Go Noto Ancient

Copyright 2022 The Noto Project Authors
(https://github.com/notofonts/latin-greek-cyrillic), as recorded in the font's
embedded copyright notice. Distributed under the SIL Open Font License 1.1;
see [fonts/GoNotoAncient-OFL.txt](fonts/GoNotoAncient-OFL.txt).

The unmodified `GoNotoAncient.ttf` comes from the third-party
[Go Noto Universal v7.0 release](https://github.com/satbyy/go-noto-universal/releases/tag/v7.0).
It combines Noto fonts for historical scripts and is a fallback for
body and monospace text, after Noto Sans Egyptian Hieroglyphs. It provides
Regular glyphs only and does not guarantee a monospace grid or full Unicode
coverage. The upstream build scripts use the Unlicense, but the generated
font is licensed under the SIL Open Font License, as stated in the
[upstream license section](https://github.com/satbyy/go-noto-universal/tree/v7.0#license).

## Go Noto Current

Copyright 2022 The Noto Project Authors
(https://github.com/notofonts/latin-greek-cyrillic), as recorded in the font's
embedded copyright notice. Distributed under the SIL Open Font License 1.1;
see [fonts/GoNotoCurrent-OFL.txt](fonts/GoNotoCurrent-OFL.txt).

The unmodified `GoNotoCurrent-Regular.ttf` comes from the third-party
[Go Noto Universal v7.0 release](https://github.com/satbyy/go-noto-universal/releases/tag/v7.0).
It combines Noto fonts for contemporary scripts and follows Go Noto Ancient
as the final fallback for body and monospace text, including N'Ko and Yi
characters used in kaomoji. It provides Regular glyphs only and does not
guarantee a monospace grid, full Unicode coverage, or complex text shaping.
The upstream build scripts use the Unlicense; the generated font uses the
SIL Open Font License, as stated in the
[upstream license section](https://github.com/satbyy/go-noto-universal/tree/v7.0#license).

## Twemoji

Emoji graphics are by Twitter, Inc. and other contributors to
[Twemoji](https://github.com/jdecked/twemoji), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The unmodified SVG artwork comes from the official
[Twemoji v17.0.3 source archive](https://github.com/jdecked/twemoji/releases/tag/v17.0.3).
[emoji/source.json](emoji/source.json) pins the archive and extracted SVG checksums;
the build downloads the assets for offline runtime use. See
[emoji/LICENSE-GRAPHICS](emoji/LICENSE-GRAPHICS). When sharing images containing
Twemoji, retain suitable attribution in accompanying documentation or credits.

## Unicode Emoji presentation data

[emoji/presentation.json](emoji/presentation.json) derives text presentation
defaults and variation sequences from Unicode 17.0 `emoji-test.txt` and
`emoji-variation-sequences.txt`; source URLs and checksums are recorded there.
Copyright © 1991–2025 Unicode, Inc. Distributed under the Unicode License V3;
see [emoji/LICENSE-UNICODE](emoji/LICENSE-UNICODE).

Runtime and build dependency licenses remain with their respective packages.

## Brand logos

The YouTube, Bilibili, Twitter and X paths embedded in
[SourceFooter](src/templates/shared/source-footer.tsx) come from
[Simple Icons 9.21.0](https://github.com/simple-icons/simple-icons/tree/9.21.0/icons),
distributed under [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/9.21.0/LICENSE.md).
The paths are unchanged; display size, viewport and color are set by Forma.
Brand names and trademarks remain the property of their respective owners.

## Satori local source patch

Satori 0.62.0 is distributed under the Mozilla Public License 2.0; its license
is included in the dependency package. Forma modifies its text layout and font
shaping code and retains its inline SVG fragment ID fix. The readable changes
are provided in [patches/satori-text-layout.source.patch](patches/satori-text-layout.source.patch),
with reproducible bundle generation in
[scripts/build-satori-patch.mjs](scripts/build-satori-patch.mjs).
