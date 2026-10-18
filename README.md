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

**dsha-camera 把这条路压成一次点击**：输入框加号右边多一个相机按钮，点开是一个**展开式取景面板**（不是全屏相机），按下白色快门，照片立刻作为附件出现在输入框附件栏里 —— 和拖一张图进来完全一样，然后你该打字打字。

- 📷 **加号右侧的相机按钮** —— 就长在输入工具行里，不会多出一个悬浮球。
- 🪟 **展开式取景框，不接管全屏** —— 面板从输入卡片上方长出来，取景框是中间一条，聊天记录仍然看得见，随时可以改主意。
- 🖼️ **照片直接进草稿** —— 走 Harness 自己的附件通道（`createDrafts` + `addAttachments`），可以和文字、其他图片混排，连拍多张也行。
- 🚫 **不写入相册 / 下载目录 / 临时文件** —— 帧只在内存里编码成 `File`，发送后由 Harness 作为会话附件保管（模型能看见图片的前提），设备相册全程零增长。
- 🧩 **双通道自适应** —— 宿主允许摄像头时用内嵌取景框；不允许时（例如当前 DSHA，见下文）同面板自动换成「系统相机 / 相册」，功能不断。
- 🌏 **中英双语**，跟随 Harness 语言；深浅色跟随主题 token。
- ⚡ **零构建** —— 纯浏览器 JS，没有打包、没有依赖、没有安装脚本，装完刷新即可用。

## 界面

```
┌──────────────────────────────────────────────┐
│ 相机图标  拍照上传                     ✕     │  ← 面板头部
│           只进输入框，不写入相册              │
├──────────────────────────────────────────────┤
│                                              │
│              取 景 框（中间一条）             │  ← 实时预览，高度约 44vh
│                                              │
├──────────────────────────────────────────────┤
│      🖼️              ◯              🔄       │  ← 相册 / 快门 / 翻转
└──────────────────────────────────────────────┘
                 ↑ 这块从输入卡片上方展开
┌──────────────────────────────────────────────┐
│ +  权限  模型                          ➤     │  ← 原来的输入卡片
└──────────────────────────────────────────────┘
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
| 点输入框加号右侧的相机图标 | 展开取景面板，开始尝试打开摄像头 |
| 点白色快门 | 当前帧编码成 JPEG，直接进入输入框草稿，面板收起 |
| 点左下相册图标 | 从系统相册挑一张，同样进入草稿 |
| 点右下翻转图标 | 前置 / 后置摄像头切换（前置自动镜像回正） |
| `Esc` / 右上 ✕ | 关闭面板并立即释放摄像头 |

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

1. **钩子位置**：`ctx.slots.inject('conversation.input.left', …)` 放按钮，`ctx.slots.inject('conversation.input.dock', …)` 放面板 —— 后者是「输入卡片上方的整宽插槽」，展开时把聊天区顶上去，正好是「拉长对话框」的效果。
2. **照片进草稿**：
   ```js
   const conversation = ctx.get('conversation')
   const drafts = conversation.createDrafts(sessionId, [file])   // 生成运行时草稿附件
   props.inputActions.addAttachments(drafts.map(d => d.id))      // 挂到当前草稿
   ```
   这和官方「拖入/粘贴图片」走的是同一条路，所以缩略图、删除、发送、失败恢复全部由 Harness 自己处理。
3. **摄像头**：`navigator.mediaDevices.getUserMedia` → `<video>` → `canvas.drawImage` → `canvas.toBlob('image/jpeg', 0.86)` → `new File(...)`。最长边压到 1600px，单张通常 200–500KB。

改完代码**不需要构建**：重新安装或刷新页面即可（Client 模块由 Harness 的模块加载器直接执行）。调整画质改 `client.js` 顶部的 `MAX_EDGE` / `JPEG_QUALITY` 两个常量。

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

**dsha-camera compresses that into one click.** A camera button sits next to the composer's `+`; it opens an **inline capture panel** (not a full-screen camera) right above the input card. Press the white shutter and the photo appears in the attachment rail of the draft — exactly as if you had dropped an image in — then you keep typing.

- 📷 **Camera button beside `+`** — part of the composer tool row, no floating bubble.
- 🪟 **Expanding viewfinder, not a takeover** — the panel grows upward from the composer; the transcript stays visible and the viewfinder is a bounded band, not the whole screen.
- 🖼️ **Straight into the draft** — through Harness's own attachment path (`createDrafts` + `addAttachments`), so it mixes with text and other images, and you can shoot several in a row.
- 🚫 **Nothing written to the album, Downloads or a temp file** — the frame is encoded in memory as a `File`; after you press send, Harness stores it as a session attachment (that is what lets the model see it).
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

### How it works

```
client.js
  ctx.slots.inject('conversation.input.left')  → camera button
  ctx.slots.inject('conversation.input.dock')  → expanding panel above the composer
  getUserMedia → <video> → canvas → toBlob('image/jpeg', .86) → File
  ctx.get('conversation').createDrafts(sessionId, [file])
  props.inputActions.addAttachments(ids)
```

Editing needs no build: change `client.js`, reload the page. Tune `MAX_EDGE` and `JPEG_QUALITY` at the top of the file for quality versus size.

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
