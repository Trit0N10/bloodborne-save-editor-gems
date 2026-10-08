# Asset inventory

The publication contains **974 newly authored assets**: 953 public PNGs, 15 desktop icon PNGs, two ICOs, one ICNS, one SVG and two generated web metadata files. All 968 PNGs retain upstream filenames and dimensions for layout compatibility; none retain upstream image pixels. The new app icon and item/gem graphics use generic geometric shapes. No game imagery, screenshots or font files are shipped.

See [artwork provenance](assets-provenance.md) for authorship, license, input scope and raster details. [The dimensions manifest](assets-dimensions.json) contains compatibility metadata. [The generated inventory](assets-inventory.json) lists paths, dimensions, byte lengths and SHA-256 hashes.

Run `node scripts/generate-artwork.mjs` to regenerate from repository files using the Node standard library. `node scripts/generate-artwork.mjs --check` checks decoded RGBA pixels, dimensions and PNG/ICO/ICNS structure against authored geometry, then verifies the recorded inventory against the exact committed bytes. Compression bytes may differ between Node/zlib runtimes without changing pixels. `node scripts/test-publication.mjs` separately verifies exact committed SHA-256 hashes and catches unaccounted assets. `node scripts/test-artwork-equivalence.mjs` tests alternate compression, changed-pixel rejection and icon-container validation. No upstream checkout, downloads or external rendering tools are required.

中文：974 个资源均由脚本新绘制或生成。968 张 PNG 保留上游路径与尺寸以兼容布局，没有保留上游像素；没有分发游戏图片、截图或字体。检查脚本比较解码后的像素及容器结构，允许不同运行时生成不同压缩字节；发布检查仍严格校验已提交文件的 SHA-256。详细来源与清单见上面的链接。
