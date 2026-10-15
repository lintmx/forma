# Frozen SVG raster references

Original self-contained SVG inputs and PNGs captured with @resvg/resvg-js 2.6.2 before removing the dependency.
The filename is SHA-256 of the exact SVG bytes; `.svg.txt` preserves these bytes without formatter changes.
Tests compare current Skia output to these fixed references, accounting for premultiplied alpha and bounded edge antialiasing.
Do not regenerate the PNGs using the implementation under test. Historical migration results remain in artifacts/skia-migration/.
