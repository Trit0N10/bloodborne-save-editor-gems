# Bloodborne Save Editor Gems

[简体中文](README.zh-CN.md)

A desktop save editor with a searchable blood-gem preset catalog, English and Simplified Chinese interfaces, and original geometric graphics. Maintained by [Trit0N10](https://github.com/Trit0N10).

This is an unofficial derivative of [Noxde/Bloodborne-save-editor 0.10.0](https://github.com/Noxde/Bloodborne-save-editor). The upstream project supplies the save parser and most editing features. This repository maintains the gem workflow, bilingual presentation, publication tooling, and artwork changes described below. It is not affiliated with Sony Interactive Entertainment or FromSoftware.

![English gem manager preview](docs/screenshots/gems.en.jpg)

Screenshot uses synthetic preview data and authored geometric graphics. [Simplified Chinese preview](docs/screenshots/gems.zh-CN.jpg).

## Download and use

Download the **Windows x64 portable ZIP** from [Releases](https://github.com/Trit0N10/bloodborne-save-editor-gems/releases). Extract the whole archive, keep `resources` beside the executable, and run **Bloodborne Save Editor Gems.exe**. Windows requires Microsoft Edge WebView2 Runtime; install it from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if it is missing.

1. Exit the game and make an independent backup of the save you intend to edit.
2. Open a **decrypted character file**, such as `userdata0000`. `userdata0010` is system data and is not a character save. The editor does not decrypt console saves.
3. Select the inventory, storage, stats, character, boss, or flag page. Use **Manage blood gems** to search presets, filter shapes, add a quantity, or remove an owned gem.
4. Click **Save file** and choose the output explicitly. Editing in the interface does not write changes until you save.

The upstream file loader creates `<input>.bak` when opening a supported file. That backup can be overwritten when you reopen the same input; keep your own recovery copy. Avoid editing a file while the game is running. Use the toolbar language selector for **English / 简体中文**; English is the first-launch default, and the choice is remembered locally.

## Features and contribution boundaries

| Area | Origin / changes maintained here |
| --- | --- |
| Save parsing, ordinary item/stat/character/boss/flag editing | Based on the upstream editor; original attribution retained |
| Blood-gem catalog | 117 curated presets, 132 preset/shape combinations, documented source links and English names |
| Gem management | Shape filtering, quantity-aware capacity checks, independent registry allocation, and deletion workflow; unsupported layouts fail validation |
| UI | English-first and Simplified Chinese presentation, desktop navigation and text-based inventory views |
| Visual assets | Authored geometric replacements; no bundled game screenshots, extracted item images, or fonts |
| Publication | Locked dependency builds, synthetic checks, portable packaging, source archive and SHA-256 checksums |

This is a save editor, not a PC port, emulator, server, or online-play client. Numeric IDs and save-format metadata remain necessary for compatibility. Narrative item descriptions are omitted from this publication build. See [NOTICE](NOTICE.md) for upstream credits and [architecture](docs/architecture.md) for implementation details.

## Build

Install **Node.js 22.12 or newer**, a stable Rust toolchain, and the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/), including the MSVC C++ build tools and WebView2 Runtime. The release target is Windows x64.

```powershell
npm ci
npm run check
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib publication_
npm run tauri -- build --no-bundle -- --locked
```

Alternatively, `./scripts/build-windows.ps1` runs these checks and builds the executable. Use `./scripts/package-release.ps1` to create portable and corresponding-source archives plus `SHA256SUMS.txt` in the ignored `release` directory.

The geometric graphics are checked in and can be regenerated with `node scripts/generate-artwork.mjs`. No game install is required to build. See [testing](docs/testing.md) and [asset provenance](docs/assets.md).

## Validation and limitations

Synthetic tests check catalog consistency, selected registry/mutation behavior and localization; the frontend and native Windows builds are checked separately. These checks do **not** establish that every editing feature works with every save or that edits are accepted by the game. Upstream tests requiring omitted save fixtures are explicitly excluded from publication acceptance. There are no personal saves in this repository.

The release is unsigned. The registry-based gem workflow intentionally rejects unverified layouts instead of guessing offsets. Game/version compatibility and unusual save states still need user validation on backed-up copies. Automatic updates are disabled; download updates from this repository's releases.

## License

GPL-3.0; see [LICENSE](LICENSE). Preserve notices when redistributing a derivative and provide corresponding source for distributed binaries under the applicable GPL terms. Third-party dependencies retain their own licenses. The project does not grant rights to game content or trademarks.
