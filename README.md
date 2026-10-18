# dsha-camera · DSHA 拍照直传

> 在 DeepSeek Harness 的输入框里点一下就能拍，照片直接进草稿。
> One tap from the composer to the system camera — the photo lands in the draft.

<p>
  <a href="https://www.npmjs.com/package/dsha-camera"><img alt="npm" src="https://img.shields.io/npm/v/dsha-camera?color=cb3837"></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-%E2%89%A50.2.0--rc.2-4c6ef5">
  <img alt="build" src="https://img.shields.io/badge/build-none-brightgreen">
  <img alt="lang" src="https://img.shields.io/badge/i18n-中文%20%7C%20English-2f9e44">
</p>

简体中文 · [English](#english) · [更新记录](CHANGELOG.md)

---

## 它做什么

输入框的 `+` 右侧多一个相机按钮：

| 操作 | 结果 |
|---|---|
| **点一下** | 直接调起系统相机（`<input type="file" capture="environment">`），拍完回到 Harness |
| **长按 0.6 秒** | 打开相册选择已有图片 |

两种方式得到的图片都走 Harness 自己的附件通道进入草稿，可以配文字、连拍多张、发送前删除，和「拖一张图进来」完全一样。

## 说清楚「不落相册」这件事

插件本身**从不写文件**：图片只作为内存里的 `File` 存在，按下发送后才由 Harness 存为会话附件。

但**系统相机拍完会不会在相册里留一张，由相机 App 决定**，网页侧无法干预——你发起的是系统相机，它想存就存。这一点在 MIUI / 部分厂商相机上尤其明显。

想做到「零落盘」，只有让页面自己取帧（`getUserMedia` + canvas），不经过相机 App。1.0.x 版本就是这么做的，但在目标机型上相机流几秒后会塌到 **1 帧/秒**（实测：同一条流上两个 `<video>` 都只有 1 帧，而页面仍跑 120 帧），重启相机只能好三五秒，属于相机 HAL 行为，插件无法修复。因此 1.1.0 把取景框整体移除，改成现在的系统相机方案。

> 旧版本仍可从 git 历史取出：`git show v1.0.13:dsha-camera/client.js`。

## 安装

**DSHA（安卓）**：插件 → 添加 → 粘贴 `https://github.com/sakurocco/dsha-camera` 或 npm 包名 `dsha-camera` → 安装 → 重启 Web。

**桌面 / 命令行**：

```bash
dsh plugin --profile <profile> add dsha-camera
```

**本地目录**：`dsh plugin --profile desktop add /path/to/dsha-camera`，或把目录放进 `~/.dsh/profiles/<profile>/node_modules/` 并按下式加一行：

```yaml
- insert:
    - id: dsha-camera
      name: dsha-camera
```

## 兼容性

- 要求 Harness ≥ `0.2.0-rc.2`（用到 `ctx.get('conversation').createDrafts` 与 `inputActions.addAttachments`）。
- **不再需要相机权限**：插件不再调用 `getUserMedia`，官方版 DSHA 直接可用，不必再为了 CAMERA 权限自己编译 APK。
- 输入框忙碌（正在发送）时会自动重试三次；仍失败则改走输入框自身的粘贴通道兜底。

## 实现

```
client.js
  ctx.slots.inject('conversation.input.left')      → 相机按钮 + 两个隐藏的 file input
  单击 → <input capture="environment">              → 系统相机
  长按 → <input accept="image/*">                   → 相册
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)            → 进入草稿
```

零构建：改 `client.js` 后刷新页面即可。

## License

MIT © 2026

---

<a id="english"></a>

## English

### What it does

A camera button sits to the right of the composer's `+`:

| Gesture | Result |
|---|---|
| **Tap** | Opens the system camera (`<input type="file" capture="environment">`), then returns to Harness |
| **Hold 0.6 s** | Opens the album picker |

Either way the image enters the draft through Harness's own attachment path, so it mixes with text, allows several shots in a row, and can be removed before sending — exactly like a dropped image.

### The honest part about "never touches the album"

The plugin never writes a file: the bytes live in memory as a `File` until you press send, and Harness then stores it as a session attachment.

But whether the camera app keeps its own copy in the device album is decided by **that app** — you are launching the system camera, and a page cannot prevent it. This is especially visible on MIUI and some vendor cameras.

The only way to guarantee zero local writes is in-page capture (`getUserMedia` + canvas), which 1.0.x did. On the target device that stream collapsed to **1 fps** a few seconds after start (measured: both `<video>` elements at 1 fps while the page still rendered at 120 fps), and reopening the camera only helped for a few seconds — camera HAL behaviour, not something a page can fix. 1.1.0 therefore removed the viewfinder entirely.

> The old implementation is still in git history: `git show v1.0.13:dsha-camera/client.js`.

### Install

- **DSHA**: Plugins → add → paste `https://github.com/sakurocco/dsha-camera` or the npm name `dsha-camera` → restart the Web UI.
- **CLI**: `dsh plugin --profile <profile> add dsha-camera`.
- **Local**: `dsh plugin --profile desktop add /path/to/dsha-camera`, or copy the directory into `~/.dsh/profiles/<profile>/node_modules/` and insert the row shown above.

### Compatibility

- Harness ≥ `0.2.0-rc.2`.
- **No camera permission required**: the plugin no longer calls `getUserMedia`, so the stock DSHA APK works — the custom rebuild for `CAMERA` is no longer needed.
- When the composer is busy the delivery retries three times, then falls back to the composer's own paste intake.

### How it works

```
client.js
  ctx.slots.inject('conversation.input.left')  → camera button + two hidden file inputs
  tap  → <input capture="environment">         → system camera
  hold → <input accept="image/*">              → album
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)       → into the draft
```

No build step: edit `client.js`, reload the page.

### License

MIT © 2026
