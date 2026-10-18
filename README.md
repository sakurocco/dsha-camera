# dsha-camera · DSHA 拍照直传

> 在 DeepSeek Harness 的输入框里直接拍照，照片进草稿，不进相册。
> Shoot straight into the composer draft of DeepSeek Harness — never into the album.

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="dsh" src="https://img.shields.io/badge/dsh-%E2%89%A50.2.0--rc.2-4c6ef5">
  <img alt="build" src="https://img.shields.io/badge/build-none-brightgreen">
  <img alt="lang" src="https://img.shields.io/badge/i18n-中文%20%7C%20English-2f9e44">
</p>

简体中文 · [English](#english)

---

## 它解决什么问题

想在手机上把「眼前的东西」直接丢给 agent，现在的流程是：打开相机 App → 拍 → 相册 → 回 Harness → 加号 → 选文件 → 找到那张照片。
多出来的每一步都在把注意力从对话里拽走，而且照片会永久留在相册里。

**dsha-camera 把这条路压成一次点击**：输入框加号右边多一个相机按钮，点开是一个**底部抽屉式取景面板**（不是全屏相机），按下白色快门，照片立刻作为附件出现在输入框附件栏里 —— 和拖一张图进来完全一样，然后你该打字打字。

- 📷 **加号右侧的相机按钮** —— 就长在输入工具行里，不会多出一个悬浮球。
- 🪟 **底部抽屉式取景框，不接管全屏** —— 面板从屏幕底部滑出、背景压暗，取景框是中间一条，聊天记录仍看得见；点遮罩、`Esc` 或 ✕ 立刻关闭。
- 🖼️ **照片直接进草稿** —— 走 Harness 自己的附件通道（`createDrafts` + `addAttachments`），可以和文字、其他图片混排，连拍多张也行。
- 🚫 **内嵌取景框路径不写相册、下载目录或临时文件** —— 帧只在内存里编码成 `File`，发送后由 Harness 作为会话附件保管（模型能看见图片的前提）。注意：走「系统相机」回退时，拍照与落盘由相机 App / 宿主选择器完成，它们会自己存一份到相册，插件既不知道也无法删除，详见下文。
- 🧩 **双通道自适应** —— 宿主允许摄像头时用内嵌取景框；不允许时（例如当前 DSHA，见下文）同面板自动换成「系统相机 / 相册」，功能不断。
- 🌏 **中英双语**，跟随 Harness 语言；深浅色跟随主题 token。
- ⚡ **零构建** —— 纯浏览器 JS，没有打包、没有依赖、没有安装脚本，装完刷新即可用。

## 界面

```
        ┌──────────────────────────────────────────┐
        │                 ▁▁▁▁                     │  ← 抽屉把手，可点遮罩关闭
        │  📷 拍照上传                        ✕    │
        │     只进输入框，不写入相册               │
        ├──────────────────────────────────────────┤
        │                                          │
        │            取 景 框（中间一条）           │  ← 实时预览，约 44vh
        │                                          │
        ├──────────────────────────────────────────┤
        │      🖼️              ◯              🔄   │  ← 相册 / 快门 / 翻转
        └──────────────────────────────────────────┘
              ↑ 从屏幕底部升起，背景压暗，不接管全屏
```

拍照后：面板收起 → 缩略图出现在输入框附件栏 → 按发送（或回车）才真正上传。

## 安装

### 方式一：DSHA 插件市场（安卓，推荐）

1. 在 DSHA 里打开「插件」→ 添加插件；
2. 粘贴仓库地址（`https://github.com/sakurocco/dsha-camera`）或 Release 里的 zip；
3. 安装完成后按提示重启 Web，刷新页面。

DSHA 会自己完成解压、依赖检查与启用，不需要命令行。

### 方式二：桌面 / 命令行

```bash
# 指向本地目录（开发时最方便，改完刷新页面即可）
dsh plugin --profile desktop add /path/to/dsha-camera

# 或者从 npm 装（发布之后）
dsh plugin --profile desktop add dsha-camera
```

也可以把它放进工作区，用 `plugin_manager` 的 `install_bundle` 安装（target 传本目录的绝对路径）。

### 方式三：手动放进 profile

把本目录整体复制到 `~/.dsh/profiles/<profile>/node_modules/dsha-camera`，然后在 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: dsha-camera
      name: dsha-camera
```

## 使用

| 动作 | 结果 |
|---|---|
| 点输入框加号右侧的相机图标 | 从底部升起取景面板，开始尝试打开摄像头 |
| 点白色快门 | 当前帧编码成 JPEG，直接进入输入框草稿，面板收起 |
| 点左下相册图标 | 从系统相册挑一张，同样进入草稿 |
| 点右下翻转图标 | 前置 / 后置摄像头切换（前置自动镜像回正）；有多个摄像头时这一格换成设备下拉 |
| `Esc` / 右上 ✕ / 点遮罩 | 关闭面板并立即释放摄像头 |

## 兼容性与已知限制（请先读这一段）

**摄像头能不能用，取决于宿主给不给权限，插件无法绕过。**

| 环境 | 内嵌取景框 | 说明 |
|---|---|---|
| 桌面 Chrome / Edge，`http://127.0.0.1:端口` | ✅ | 本机地址属于安全上下文，首次会弹权限询问 |
| **DSH 桌面 App 窗口**（Electron） | ❌ | 桌面版在 `lib/main.js` 的 `installMicrophonePermissions` 里只放行 `audio`，`video` 请求直接 `callback(false)`；面板会说明原因并给出回退 |
| 电脑浏览器经局域网访问手机上的 Harness（`http://192.168.x.x`） | ❌ | 非 HTTPS 不是安全上下文，浏览器直接不暴露 `getUserMedia`，面板会提示改用回退通道 |
| DSHA（Android，build 170 / 173） | ❌ | 已核实其 `AndroidManifest.xml` 未声明 `android.permission.CAMERA`，WebView 必然拒绝视频流；此时面板自动切换到「系统相机 / 相册」 |
| 其它自行编译的 Harness 宿主 | 取决于宿主实现 | 需要 `CAMERA` 权限 + WebView `onPermissionRequest` 放行 |

**「不写入相册」的准确含义**：插件不调用任何下载、不写 `<a download>`、不产生临时文件，帧只存在于内存的 `File` 对象里。点击发送后，Harness 会把图片作为**会话附件**保存到它自己的数据目录（`~/.dsh/attachments` 一类位置）—— 这是模型能读到图片的前提，不属于相册或用户可见的存储占用。

**「系统相机」为什么有时先打开相册**：网页请求系统相机只有 `<input type="file" accept="image/*" capture="environment">` 这一条路，`capture` 只是给宿主的一个提示。DSHA 的 WebView 会把这类请求交给它自己的照片选择器（那个页面的左上角有相机入口，点一下就能拍）。是否**直接**拉起相机由宿主的 `onShowFileChooser` / `isCaptureEnabled()` 决定，网页侧无法强制；要一步到位，需要 DSHA 处理 `isCaptureEnabled`，或者补上 `CAMERA` 权限让内嵌取景框可用。

**为什么用系统相机拍完，相册里会多一张**：回退路径下，照片是**相机 App 先写进 MediaStore（相册）**，再把文件交给网页的。网页拿到的只是一个 `File` 对象，既看不到、也删不掉磁盘上那一份；把插件卸载掉再拍，照样会多一张。这是相机 App / 宿主选择器的行为。想让系统相机路径也不落盘，需要宿主用 `ACTION_IMAGE_CAPTURE` + `EXTRA_OUTPUT` 指到 `cacheDir` 的临时文件、读完即删（部分厂商相机即使给了 `EXTRA_OUTPUT` 仍会自存一份，只有内嵌取景框能彻底绕开）。

**为什么按钮在「加号右侧」但不一定紧贴加号**：Harness 的 `+` 是宿主硬编码的按钮，它右侧唯一可扩展的座位是 `conversation.input.left`，宿主会把它渲染在附件 / 权限 / 计划控件之后。手机上这些控件通常折叠，视觉上就紧邻加号；桌面窄窗口下可能隔着权限选择器。

## 它是怎么实现的（给想改它的人）

```
dsha-camera/
├── package.json          # dsh.bundle.patch + dsh.client.platform=web
├── cordis.patch.yml      # - insert: [{ id, name }]
├── index.js              # Host 半边：空 apply（纯前端插件）
├── client.js             # 全部 UI：按钮、面板、拍照、进草稿
├── locale/{zh,en}.json   # 插件管理页显示的名称与描述
├── icon.svg              # 插件图标（原创）
└── README.md
```

三个关键点，全部是 Harness 的公开接口：

1. **钩子位置**：`ctx.slots.inject('conversation.input.left', …)` 放按钮；`ctx.slots.inject('shell.overlay', …)` 放面板 —— 后者是整窗最上层的浮动层，面板用 `position: fixed` 贴底，因此**不受输入区高度限制**（1.0.0 用的是 `conversation.input.dock`，手机上会把快门裁掉，1.0.1 换掉了）。
2. **照片进草稿**：
   ```js
   const conversation = ctx.get('conversation')
   const drafts = conversation.createDrafts(sessionId, [file])   // 生成运行时草稿附件
   props.inputActions.addAttachments(drafts.map(d => d.id))      // 挂到当前草稿
   ```
   这和官方「拖入/粘贴图片」走的是同一条路，所以缩略图、删除、发送、失败恢复全部由 Harness 自己处理。面板在浮层里拿不到 Session 的 props，所以按钮打开面板时把 `sessionId` 和 `inputActions` 一起交给面板。
3. **摄像头**：`navigator.mediaDevices.getUserMedia` → `<video>` → `canvas.drawImage` → `canvas.toBlob('image/jpeg', 0.86)` → `new File(...)`。最长边压到 1600px，单张通常 200–500KB。

改完代码**不需要构建**：重新安装或刷新页面即可（Client 模块由 Harness 的模块加载器直接执行）。调整画质改 `client.js` 顶部的 `MAX_EDGE` / `JPEG_QUALITY` 两个常量。

## 更新记录

- **1.0.3** —— 「加入草稿」更不容易失败：输入框忙碌时自动重试 3 次；仍被拒绝、或宿主没把 `inputActions` 交给插件时，改走输入框自己的粘贴通道（带附件数量校验）；失败提示里会写出**当时的输入状态**，方便定位。
- **1.0.2** —— 修正隐私措辞：只有内嵌取景框路径不落盘；系统相机回退由相机 App 写入相册，插件无法阻止。面板里补了对应提示。
- **1.0.1** —— 面板从「输入框上方插槽」改为「整窗浮层 + 底部抽屉」，修复手机上快门被输入区裁掉；补「相册里点左上角相机图标」的提示；「系统相机」在桌面端隐藏（那里它只是文件选择器）。
- **1.0.0** —— 首个版本：加号右侧相机按钮、取景面板、照片直入草稿、中英双语。

## 隐私

- 不联网、不埋点、不读取任何工作区文件；
- 只在用户点开面板时申请摄像头；面板一关（含 `Esc`、切后台）立刻 `track.stop()`；
- 照片在按下发送之前不会离开浏览器，也不会落盘。

## 发布到 GitHub（让别人也能装）

```bash
cd dsha-camera
git init
git add .
git commit -m "feat: dsha-camera 1.0.0 — 拍照直传"
git branch -M main
git remote add origin https://github.com/sakurocco/dsha-camera.git
git push -u origin main
```

打一个 Release（DSHA 支持直接装 zip）：

```bash
git tag v1.0.0
git push origin v1.0.0
# 在 GitHub → Releases → Draft a new release 里选择该 tag，
# 附件上传整个仓库 zip（或 npm pack 产物 dsha-camera-1.0.0.tgz）
```

发 npm（可选，方便 `dsh plugin add dsha-camera`）：

```bash
npm publish --access public     # 包名被占用时改成 @YOUR_GITHUB_NAME/dsha-camera
```

别人拿到后：DSHA 里粘贴仓库链接，或 `dsh plugin --profile <profile> add <仓库地址>`，重启 Web 即生效。

## License

MIT © 2026

---

<a id="english"></a>

## English

### What it does

Sending "what I'm looking at" to the agent currently costs six steps: open the camera app, shoot, open the album, switch back to Harness, press `+`, find the photo. Every step pulls attention out of the conversation — and the photo stays in the album forever.

**dsha-camera compresses that into one click.** A camera button sits next to the composer's `+`; it opens a **bottom-sheet capture panel** (not a full-screen camera) that slides up over a scrim. Press the white shutter and the photo appears in the attachment rail of the draft — exactly as if you had dropped an image in — then you keep typing.

- 📷 **Camera button beside `+`** — part of the composer tool row, no floating bubble.
- 🪟 **Bottom-sheet viewfinder, not a takeover** — the panel rises from the bottom edge over a scrim; the viewfinder is a bounded band, not the whole screen, and a tap on the scrim, `Esc` or ✕ closes it.
- 🖼️ **Straight into the draft** — through Harness's own attachment path (`createDrafts` + `addAttachments`), so it mixes with text and other images, and you can shoot several in a row.
- 🚫 **Nothing written to the album on the inline path** — the frame is encoded in memory as a `File`; after you press send, Harness stores it as a session attachment (that is what lets the model see it). The system-camera fallback is different: the camera app and the host picker do the capture and the writing, keep their own copy in the album, and the plugin can neither see nor delete it — see below.
- 🧩 **Dual-channel fallback** — hosts that grant camera access get the inline viewfinder; hosts that don't (e.g. current DSHA, see below) get the system camera / album inside the same panel.
- 🌏 **Bilingual** copy that follows the Harness locale, with light/dark handled by theme tokens.
- ⚡ **No build** — plain browser JavaScript, no bundler, no dependency, no install script.

### Install

1. **DSHA plugin market** — open Plugins → add, paste `https://github.com/sakurocco/dsha-camera` or a Release zip, install, restart the Web UI.
2. **CLI** — `dsh plugin --profile desktop add /path/to/dsha-camera` (or the npm name once published).
3. **Manual** — copy this directory to `~/.dsh/profiles/<profile>/node_modules/dsha-camera` and insert the row shown in `cordis.patch.yml`.

### Compatibility and limits

| Host | Inline viewfinder | Why |
|---|---|---|
| Desktop Chrome/Edge on `http://127.0.0.1:<port>` | ✅ | loopback is a secure context; the browser asks once |
| **The DSH desktop app window** (Electron) | ❌ | `installMicrophonePermissions` in `lib/main.js` grants `audio` only and answers `callback(false)` for `video`; the panel explains this and offers the fallbacks |
| A PC browser reaching the phone over LAN (`http://192.168.x.x`) | ❌ | not a secure context, `getUserMedia` is not exposed; the panel falls back |
| DSHA Android build 170 / 173 | ❌ | its `AndroidManifest.xml` declares no `android.permission.CAMERA`, so the WebView rejects the stream; the panel switches to the system camera automatically |
| Custom hosts | Host-dependent | needs `CAMERA` plus a permissive `onPermissionRequest` |

**"No local storage" means**: the plugin never downloads, never writes a temp file and never touches the album; the bytes live in memory until you press send. Harness then stores the image as a session attachment — otherwise the model could not read it. The camera track is stopped the moment the panel closes, including `Esc` and backgrounding the tab.

**Why "system camera" sometimes opens the album first**: the only web-level request for the device camera is `<input type="file" accept="image/*" capture="environment">`, and `capture` is only a hint. DSHA's WebView routes that request to its own photo picker, which carries a camera tile in its top-left corner. Whether the host launches the camera directly is decided by its `onShowFileChooser` / `isCaptureEnabled()`, so a page cannot force it: a one-tap camera needs DSHA to honour `isCaptureEnabled`, or to grant `CAMERA` so the inline viewfinder works.

**Why the system camera leaves a copy in the album**: on the fallback path the camera app writes the photo into MediaStore first and only then hands the file to the page. The page receives a `File` object and can neither see nor delete the copy on disk — uninstall the plugin, take the same photo, and the album still grows. Removing that write needs the host to use `ACTION_IMAGE_CAPTURE` with `EXTRA_OUTPUT` pointing at a `cacheDir` temp file and delete it after reading (some vendor cameras keep their own copy anyway; only the inline viewfinder avoids the camera app entirely).

### How it works

```
client.js
  ctx.slots.inject('conversation.input.left')  → camera button
  ctx.slots.inject('shell.overlay')            → frame-wide scrim + bottom sheet
  getUserMedia → <video> → canvas → toBlob('image/jpeg', .86) → File
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)
```

Editing needs no build: change `client.js`, reload the page. Tune `MAX_EDGE` and `JPEG_QUALITY` at the top of the file for quality versus size.

### Changelog

- **1.0.3** — harder to fail on the way into the draft: three retries while the composer is busy; when it still refuses, or when the host never passes `inputActions` to the slot, the file goes through the composer's own paste intake (confirmed by the attachment count). A failure now names the composer phase it saw.
- **1.0.2** — corrected the privacy wording: only the inline viewfinder path avoids local writes; the system-camera fallback is stored by the camera app, which the plugin cannot prevent. The panel now says so.
- **1.0.1** — the panel moved from the composer dock to a frame-wide overlay bottom sheet, fixing the shutter being clipped by the composer on phones; added the "tap the camera tile in the album" hint; hid the system-camera pill on desktop, where it is only a file dialog.
- **1.0.0** — first release: camera button beside `+`, capture sheet, photo straight into the draft, bilingual copy.

### Publish

```bash
git init && git add . && git commit -m "feat: dsha-camera 1.0.0"
git branch -M main
git remote add origin https://github.com/sakurocco/dsha-camera.git
git push -u origin main
git tag v1.0.0 && git push origin v1.0.0   # then attach a zip to the Release
```

### License

MIT © 2026
