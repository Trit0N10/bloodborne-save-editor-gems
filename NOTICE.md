# Attribution and provenance

## Upstream

This repository derives from **Noxde/Bloodborne-save-editor 0.10.0**:
https://github.com/Noxde/Bloodborne-save-editor

The upstream Rust manifest credits **Noxde** and **Valentino Amato**. The save parser and much of the editing logic and component structure originate there. GPL-3.0 and upstream notices are retained. New publication work is maintained by Trit0N10; it does not imply authorship of the upstream parser or game.

The original upstream acknowledgments credit Meph and Bloodborne Wiki for reference metadata, foxyhooligan for effect IDs and flags, PlayingUnfairly for editing tutorials, xtrin for gem-display information, and n3r4_ for boss flags. Reference: https://github.com/Noxde/Bloodborne-save-editor#4-attributions

## Presets and metadata

Resource JSON uses game-format identifiers, item/effect names and numeric metadata for interoperability. Preset entries contain their own `source` links and notes; they are not claims that this project discovered the underlying game data. Narrative item descriptions and their corresponding translation entries are removed from this publication build. Game art is not included.

Bloodborne, PlayStation and related names are used descriptively. Game content and trademarks belong to their respective owners. This project is unofficial and makes no claim of endorsement or universal legal clearance.

## Authored visuals

The publication graphics are generated from authored geometric primitives, not traced or recolored game images. See `scripts/generate-artwork.mjs` and `docs/assets.md` for reproducible provenance. No borrowed fonts or game screenshot documentation are distributed.

## Dependencies

React, Vite, Tauri and transitive crates/packages retain their own copyright and license terms. JavaScript and Rust lockfiles identify the dependency versions used. See `docs/dependency-licenses.json` for license declarations available in the installed package metadata and the locked Rust registry manifests; individual dependency licenses remain authoritative.
