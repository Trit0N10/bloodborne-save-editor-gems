# Testing and acceptance boundaries

The publication checks are deliberately separate from gameplay claims.

```powershell
npm run check
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib publication_
npm run tauri -- build --no-bundle -- --locked
```

- Localization checks cover English default, Simplified Chinese output and display-only identifiers.
- The publication scanner checks repository contents and package hygiene.
- Synthetic Rust tests use authored memory buffers and catalog data, without requiring or publishing personal saves.
- Fixture-dependent upstream tests retain their code but are explicitly ignored/excluded because their save files are not distributed. Running a filtered suite does not imply the omitted tests passed.
- Frontend preview checks exercise language switching and screen layout with mocked Tauri responses. Preview mocks are not a functioning save editor or native file-dialog test.

Native compilation and synthetic tests do not validate every upstream command, every regional game version, or acceptance of edited saves by the game. No automated check opens the user's current game/save files. Users should verify on independently backed-up copies.

The upstream loader copies an opened supported input to `<path>.bak`; that file may replace an older backup with the same name. Saving is explicit and writes the selected output. These behaviors are documented, not a guarantee against every invalid input or interrupted write.

Specific counts and outcomes for release 0.11.0 are recorded in `docs/release-validation.json` after the checks complete.
