# Gem registry validation notes

The implementation and acceptance tests are in `src-tauri/src/data_handling/gem_registry.rs` and `gem_manager.rs`. The independent publication tests use authored in-memory buffers, not distributed game save files or executable disassembly.

- The supported workflow validates a version-65 stream, fixed physical length, section boundaries and a 4096-position logical registry.
- An empty record is 8 bytes, an upgrade is 40 bytes, and an equipment record is 60 bytes. Upgrade records precede other records and are indexed by low 16 handle bits.
- Serialization relocates the validated trailing stream and header section offsets while preserving its contents. A ring sentinel remains empty.
- Container counters, physical slot indices and opaque references limit capacity. Quantity requests are validated before committing a cloned in-memory mutation.
- Publication tests exercise add/delete/re-add, inventory and storage, all 117 presets / 132 shape combinations, byte readback, preserved non-target state, invalid layouts and full-capacity atomic rejection.

These checks support specific serializer invariants. They do not replace game acceptance testing or justify supporting arbitrary layouts. See `docs/testing.md` for validation boundaries.
