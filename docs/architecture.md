# Architecture and contribution map

## Backend

`src-tauri/src/data_handling/` contains the upstream-derived binary save parser and mutation helpers. `src-tauri/src/lib.rs` exposes Tauri commands. Resource JSON carries names, IDs, offsets and effects. The native save model remains the authority for edits; UI translation never changes IDs, enum values or command names.

The maintained `gem_manager.rs` / `gem_registry.rs` workflow validates a supported version-65 registry layout, checks actual capacity, assigns independent gem handles, relocates serialized sections and updates container references. New records consume real free logical positions, with one empty registry sentinel retained. Unsupported boundaries and record layouts are rejected. Add/delete mutations occur in memory; disk output remains an explicit save action.

## Presentation

React components render navigation, inventory and editing pages. `src/localization/` maps presentation text to English or Simplified Chinese. The loaded save model is independent of the selected display language. Resource identifiers and original English effect labels remain stable for backend interoperability.

Some upstream screens still use canvas layout. Generated geometric assets retain expected dimensions so the canvas editors remain usable without the original artwork. Text rows and the gem-manager dialog supply readable labels independently of images.

## Distribution

The portable executable expects its `resources` directory alongside it. Dependency locks, Windows scripts and CI define the build; generated outputs, test saves and local caches are ignored. Automatic updater support is removed to prevent the derivative from installing an upstream build. The app uses a separate desktop identifier for its local preferences.
