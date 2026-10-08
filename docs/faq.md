# Frequently asked questions

**English** | [简体中文](faq.zh-CN.md)

[Back to the project](../README.md) · [Downloads](https://github.com/Trit0N10/bloodborne-save-editor-gems/releases/latest)

## Which file should I download?

Choose `Bloodborne-Save-Editor-Gems-<version>-windows-x64.zip` from the release's **Assets** section. Extract the entire ZIP and keep `resources` beside `Bloodborne Save Editor Gems.exe`.

The `-source.zip` archive and GitHub's **Source code** downloads contain source files, not a ready-to-run app. `SHA256SUMS.txt` lists checksums for the app and corresponding-source archives.

## What do I need to run the app?

The release targets Windows x64 and requires Microsoft Edge WebView2 Runtime. If the runtime is missing, install it from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). Rust, Node.js, and the C++ build tools are needed to build from source, not to run the portable release.

If the app still will not start, report the editor and Windows versions and the exact message shown. Include whether the complete ZIP was extracted and WebView2 Runtime is installed.

## Which save file should I open?

Open a **decrypted character file**, such as `userdata0000`. `userdata0010` contains system data. This editor does not decrypt console saves or select the active save directory for your game.

Use the save location configured for your game, emulator, or port. If you have several installations or save copies, confirm which character file the game actually uses before editing it.

## Why will a file not open?

Check that it is a decrypted character file rather than encrypted console data, a ZIP archive, or system data. A damaged file or unsupported format may also fail to load. Record the exact error rather than changing file contents to try to bypass it.

If a known-good backup also fails, [report the problem](https://github.com/Trit0N10/bloodborne-save-editor-gems/issues/new/choose) with the editor version, file name, save source, and error. A report does not require uploading the save itself.

## Why does adding a gem fail?

Gem creation checks the registry layout and available capacity in the selected inventory or storage container. A layout that cannot be validated, or insufficient capacity for the requested quantity, will prevent the operation.

Use the error message to identify the cause. If the message is about capacity, lower the quantity or free space through the game's normal inventory tools. If the layout is unsupported, include the exact error and save source in a bug report; reducing the quantity does not make an unsupported layout valid.

## Why do my changes not appear in the game?

Interface edits stay in memory until you choose **Save file**. Some pages also have an action that confirms or applies a change before saving. Close the gem manager and save the file from the main toolbar after adding or deleting gems.

Exit the game before editing. Check that the output was saved to the character file used by that installation, or imported through the save workflow it requires. A successful save operation does not by itself establish that every edit is supported by the game.

## How do I restore a backup?

Exit the game and close the editor. Copy the backup and the edited file to a separate location before replacing anything, then restore the known-good backup using your game's or emulator's save workflow.

Opening a file creates an `<input>.bak` copy. For example, preserve `userdata0000.bak` elsewhere, then make a copy named `userdata0000` for restoration. Console workflows may still require encryption and import through their own tools.

Reopening the input can overwrite its `.bak`, so that file may no longer contain the progress you want to recover. Keep a separate backup from before editing; the editor cannot recreate a missing earlier save.

## Are all saves and game versions tested?

No. Build, localization, asset, and selected synthetic gem tests have passed. Interface checks use synthetic data. Real-save and in-game testing have not been completed for release 0.11.0. See [testing details](testing.md) and [the validation record](release-validation.json) for the exact scope.

If these answers do not resolve a problem, [open a bug report](https://github.com/Trit0N10/bloodborne-save-editor-gems/issues/new/choose).
