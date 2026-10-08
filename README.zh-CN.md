# 血源存档编辑器 · 血宝石版

[English — primary documentation](README.md)

提供血宝石预设检索、英语与简体中文切换，以及自制几何图形的桌面存档编辑器。由 [Trit0N10](https://github.com/Trit0N10) 维护。

本项目基于 [Noxde/Bloodborne-save-editor 0.10.0](https://github.com/Noxde/Bloodborne-save-editor)。存档解析和多数基础编辑功能来自上游；本仓库维护血宝石流程、双语界面、素材替换和发布工具。属于非官方衍生项目，与索尼及 FromSoftware 无关联。

![简中血宝石管理预览](docs/screenshots/gems.zh-CN.jpg)

截图使用合成预览数据和自制几何图形。[英语界面预览](docs/screenshots/gems.en.jpg)。

## 下载与使用

在 [Releases](https://github.com/Trit0N10/bloodborne-save-editor-gems/releases) 下载 **Windows x64 portable ZIP**，完整解压，保持 `resources` 文件夹与 `Bloodborne Save Editor Gems.exe` 同级，然后运行 EXE。需要 Microsoft Edge WebView2 Runtime；缺失时从 [微软官网](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 安装。

1. 退出游戏，单独备份待编辑的角色存档。
2. 打开已解密的角色文件，例如 `userdata0000`。`userdata0010` 是系统数据，请勿当作角色存档打开。本软件不负责解密主机存档。
3. 选择背包、仓库、能力、角色、头目或事件标记页面。在血宝石管理中检索预设、筛选形状、按数量新增或删除已有宝石。
4. 编辑结束后点击保存，明确选择输出文件。界面中的修改不会自动写回磁盘。

上游读取器打开支持的文件时会创建 `<输入文件>.bak`；再次打开同一文件可能覆盖该备份，因此仍需自己保留独立恢复副本。不要在游戏运行时编辑它正在使用的文件。右上角可选择 **English / 简体中文**；首次启动默认英语，之后记住选择。

## 功能与来源

- 存档解析及普通物品、能力、角色、头目、事件编辑：基于上游，保留原作者署名。
- 血宝石：117 个预设、132 个预设与形状组合，含资料来源链接；支持形状筛选、容量检查、按数量独立分配记录以及删除。不支持的布局会拒绝修改。
- 界面：英语优先、简中切换、桌面导航和文字物品列表。
- 素材：自制几何图形，不附带游戏截图、提取的物品图片或字体；发布版省略物品背景故事描述。
- 发布：锁定依赖、合成数据检查、便携包、对应源码包和 SHA-256 校验值。

这是一款存档编辑器；不包含游戏本体，不提供模拟、游戏移植或联机服务。兼容所需的数值 ID 与格式元数据仍保留。详细来源见 [NOTICE](NOTICE.md)。

## 构建

安装 Node.js 22.12 或更新版本、Rust stable，以及 [Tauri Windows 构建依赖](https://v2.tauri.app/start/prerequisites/)，包括 MSVC C++ 工具和 WebView2 Runtime。

```powershell
npm ci
npm run check
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib publication_
npm run tauri -- build --no-bundle -- --locked
```

也可运行 `./scripts/build-windows.ps1`；随后运行 `./scripts/package-release.ps1`，在被 Git 忽略的 `release` 目录生成 Windows 便携包、源码包和 `SHA256SUMS.txt`。几何图形已随源码提供，可用 `node scripts/generate-artwork.mjs` 重新生成。

## 验证与限制

合成数据测试覆盖预设一致性、部分注册表与修改流程及本地化，前端和 Windows 程序构建另行检查。它们不能证明所有功能、所有存档及游戏内行为都正常。依赖上游存档样本的测试不计入本次发布验收，仓库不包含个人存档。详细说明见 [测试记录](docs/testing.md)。

发布程序没有数字签名。血宝石记录新增会拒绝未验证布局。使用备份副本验证实际游戏与存档兼容性。自动更新已禁用，需要从本仓库发布页下载新版本。

## 许可证

GPL-3.0，见 [LICENSE](LICENSE)。重新分发时保留相关声明；分发二进制时按 GPL 条款提供对应源码。第三方依赖保留各自许可证。本项目不授予游戏内容或商标的使用权。
