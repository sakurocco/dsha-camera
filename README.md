# dsha-camera · DSHA 拍照直传

> 在聊天输入框点一下相机按钮，拍完直接进聊天框。
> One tap beside the composer: shoot with the system camera, and the photo lands in the chat box.

<p>
  <a href="https://www.npmjs.com/package/dsha-camera"><img alt="npm" src="https://img.shields.io/npm/v/dsha-camera?color=cb3837"></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-%E2%89%A50.2.0--rc.2-4c6ef5">
  <img alt="build" src="https://img.shields.io/badge/build-none-brightgreen">
  <img alt="lang" src="https://img.shields.io/badge/i18n-中文%20%7C%20English-2f9e44">
</p>

简体中文 · [English](#english) · [更新记录](CHANGELOG.md)

---

## 功能

输入框 `+` 右侧多出一个相机按钮：

- **点一下**：打开系统相机，拍完自动回到 Harness，照片直接出现在输入框里；
- 照片作为普通附件进入草稿，可以配文字、连拍多张、发送前删除，和拖一张图进来完全一样；
- 中英双语，跟随 Harness 的语言设置；零构建，装完刷新页面即可用。

插件不写任何文件：照片只存在于草稿里，按下发送后才由 Harness 保存为会话附件。

## 安装

**DSHA（安卓）**：插件 → 添加 → 粘贴 `https://github.com/sakurocco/dsha-camera`（或 npm 包名 `dsha-camera`）→ 安装 → 重启 Web。

**桌面 / 命令行**：

```bash
dsh plugin --profile <profile> add dsha-camera
```

**本地目录**：`dsh plugin --profile desktop add /path/to/dsha-camera`，或把目录放进 `~/.dsh/profiles/<profile>/node_modules/`，再加入下面这一行：

```yaml
- insert:
    - id: dsha-camera
      name: dsha-camera
```

## 兼容性

- 要求 Harness ≥ `0.2.0-rc.2`（依赖 `ctx.get('conversation').createDrafts` 与 `inputActions.addAttachments`）；
- **不需要相机权限**：插件调用系统相机，不使用 `getUserMedia`，官方版 DSHA 直接可用；
- 输入框正在发送时，附件写入会自动重试三次。

## 实现

```
client.js
  ctx.slots.inject('conversation.input.left')   → 相机按钮
  点击 → <input type="file" capture="environment"> → 系统相机
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)        → 进入输入框
```

零构建：改 `client.js` 后刷新页面即可生效。

## License

MIT © 2026

---

<a id="english"></a>

## English

### What it does

A camera button sits to the right of the composer's `+`:

- **Tap** it: the system camera opens; shoot, come back, and the photo is already in the input box;
- The photo becomes a normal attachment of the draft — add text, take several in a row, remove before sending, exactly like a dropped image;
- Bilingual copy that follows the Harness locale; no build step, reload the page after installing.

The plugin never writes a file: the photo lives in the draft and is stored as a session attachment only after you press send.

### Install

- **DSHA**: Plugins → add → paste `https://github.com/sakurocco/dsha-camera` (or the npm name `dsha-camera`) → restart the Web UI.
- **CLI**: `dsh plugin --profile <profile> add dsha-camera`.
- **Local**: `dsh plugin --profile desktop add /path/to/dsha-camera`, or copy the directory into `~/.dsh/profiles/<profile>/node_modules/` and insert the row shown above.

### Compatibility

- Harness ≥ `0.2.0-rc.2`.
- **No camera permission required**: the plugin opens the system camera and never calls `getUserMedia`, so the stock DSHA build works.
- If the composer is busy sending, the attachment write retries three times.

### How it works

```
client.js
  ctx.slots.inject('conversation.input.left')   → camera button
  tap → <input type="file" capture="environment"> → system camera
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)        → into the composer
```

No build step: edit `client.js`, reload the page.

### License

MIT © 2026
