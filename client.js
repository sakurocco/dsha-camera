/**
 * dsha-camera — Client half (plain browser JavaScript, no build step).
 *
 * What it adds to the Harness Web page
 * ------------------------------------
 * 1. `conversation.input.left` — a camera button in the composer tool row,
 *    right after the shipped `+` control (the host renders that seat after the
 *    attachment and permission controls, which collapse on narrow layouts).
 * 2. `conversation.input.dock` — the expanding capture panel above the
 *    composer card. Opening it grows the composer region instead of taking
 *    over the whole screen: the viewfinder is a bounded band in the middle.
 *
 * How a photo reaches the draft
 * -----------------------------
 * The browser half uses only public Client APIs:
 *   - `ctx.get('conversation').createDrafts(sessionId, files)` registers
 *     runtime-only draft attachments and returns their ids;
 *   - the `inputActions` standard prop's `addAttachments(ids)` appends those
 *     ids to the current draft, exactly like a dropped or pasted image.
 * Nothing is written to the album, the Downloads directory or a temporary
 * file: the frame lives in memory as a `File` until the user sends it.
 *
 * Camera availability
 * -------------------
 * `getUserMedia` needs a secure context and a host that grants camera access.
 * The DSHA Android launcher (build 170 / 173) declares no CAMERA permission,
 * so its WebView rejects the request; the panel then offers the system camera
 * through `<input type="file" accept="image/*" capture="environment">`, which
 * returns a photo without the page ever touching the camera device. Desktop
 * browsers and any host that grants the permission get the inline viewfinder
 * automatically — no configuration and no second code path to maintain.
 */

window.__ModuleLoader__.load({
  id: 'dsha-camera',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** Longest edge of an encoded frame, in source pixels. */
    const MAX_EDGE = 1600
    /** JPEG quality for the encoded frame. */
    const JPEG_QUALITY = 0.86
    /** Image MIME types the composer accepts as image drafts. */
    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    /** Remembered camera device for this browser origin. */
    const DEVICE_KEY = 'dsha-camera:device'

    // ---------------------------------------------------------------------
    // Copy
    // ---------------------------------------------------------------------

    const COPY = {
      zh: {
        'trigger.open': '拍照上传',
        'panel.title': '拍照上传',
        'panel.hint': '只进输入框，不写入相册',
        'panel.close': '关闭',
        'shutter': '拍照',
        'flip': '切换摄像头',
        'album': '相册',
        'system': '系统相机',
        'stage.starting': '正在启动摄像头…',
        'stage.blocked': '内嵌取景框不可用',
        'stage.unsupported': '当前环境不提供摄像头数据流',
        'stage.useFallback': '可以改用系统相机拍摄，或从相册选择。',
        'stage.desktopShell': '桌面 App 窗口按策略只放行麦克风，摄像头请求会被拒绝。用 Chrome / Edge 打开同一个地址即可看到取景框。',
        'stage.pickerHint': '若打开的是「安全访问 / 相册」，点左上角的相机图标可直接拍；注意系统相机会自己往相册存一份，插件无法阻止。',
        'camera.label': '摄像头',
        'camera.auto': '自动选择',
        'retry': '重试',
        'copyAddress': '复制地址',
        'copied': '已复制',
        'reason.denied': '摄像头权限被拒绝',
        'reason.notfound': '没有找到可用的摄像头',
        'reason.busy': '摄像头被其他程序占用',
        'reason.unknown': '无法打开摄像头',
        'error.bridge': '没找到会话的附件接口，请确认 Harness 版本不低于 0.2.0-rc.2',
        'error.locked': '输入框暂时不接受附件（状态：{phase}），等这次发送结束后再试。',
        'error.api': '当前 Harness 没有向插件暴露附件接口，照片没能放进输入框。',
        'error.encode': '这一帧编码失败，请重试',
        'error.type': '只支持 JPEG / PNG / WebP / GIF 图片',
        'error.session': '当前没有可用的会话',
      },
      en: {
        'trigger.open': 'Take a photo',
        'panel.title': 'Take a photo',
        'panel.hint': 'Goes into the draft only, never the album',
        'panel.close': 'Close',
        'shutter': 'Shoot',
        'flip': 'Switch camera',
        'album': 'Album',
        'system': 'System camera',
        'stage.starting': 'Starting the camera…',
        'stage.blocked': 'Inline viewfinder unavailable',
        'stage.unsupported': 'This environment exposes no camera stream',
        'stage.useFallback': 'Use the system camera, or pick an image from the album.',
        'stage.desktopShell': 'The desktop app window grants the microphone only, so camera requests are refused. Open the same address in Chrome or Edge to get the viewfinder.',
        'stage.pickerHint': 'If the album opens instead, tap the camera tile in its top-left corner to shoot — and note the system camera app keeps its own copy in the album.',
        'camera.label': 'Camera',
        'camera.auto': 'Automatic',
        'retry': 'Retry',
        'copyAddress': 'Copy address',
        'copied': 'Copied',
        'reason.denied': 'Camera permission was denied',
        'reason.notfound': 'No camera was found',
        'reason.busy': 'Another app is using the camera',
        'reason.unknown': 'The camera could not be opened',
        'error.bridge': 'The draft attachment API is missing; Harness 0.2.0-rc.2 or newer is required',
        'error.locked': 'The composer is not accepting attachments right now (phase: {phase}). Try again once the current send settles.',
        'error.api': 'This Harness build does not expose the attachment API to plugins, so the photo could not be placed in the draft.',
        'error.encode': 'This frame could not be encoded, please try again',
        'error.type': 'Only JPEG / PNG / WebP / GIF images are supported',
        'error.session': 'No session is available',
      },
    }

    function makeT(tag) {
      const lang = typeof tag === 'string' && tag.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      const table = COPY[lang] || COPY.en
      return function translate(key, vars) {
        let text = table[key]
        if (text === undefined) text = COPY.en[key]
        if (text === undefined) return key
        if (vars === undefined) return text
        return text.replace(/\{(\w+)\}/g, function (match, name) {
          return vars[name] === undefined ? match : String(vars[name])
        })
      }
    }

    /** Read the active locale id from the Client locale service, defensively. */
    function activeLocale(ctx) {
      try {
        const locale = ctx && typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (!locale) return 'en'
        const snapshot =
          typeof locale.getSnapshot === 'function'
            ? locale.getSnapshot()
            : typeof locale.getLocale === 'function'
              ? locale.getLocale()
              : undefined
        const raw = snapshot && (snapshot.active || snapshot.locale || snapshot.id)
        return typeof raw === 'string' && raw.length > 0 ? raw : 'en'
      } catch (error) {
        return 'en'
      }
    }

    /** Re-render when the user switches language. */
    function useLocaleTag(ctx) {
      const [tag, setTag] = useState(function () {
        return activeLocale(ctx)
      })
      useEffect(
        function () {
          setTag(activeLocale(ctx))
          const locale = ctx && typeof ctx.get === 'function' ? ctx.get('locale') : undefined
          if (!locale || typeof locale.subscribe !== 'function') return undefined
          return locale.subscribe(function () {
            setTag(activeLocale(ctx))
          })
        },
        [ctx],
      )
      return tag
    }

    // ---------------------------------------------------------------------
    // Sheet state (one floating sheet for the whole frame)
    // ---------------------------------------------------------------------

    /**
     * The capture surface lives in the frame-wide overlay layer, not inside
     * the composer: a composer-sized seat clips the footer (and with it the
     * shutter) on phones, which is exactly what happened in the dock version.
     */
    const SHEET = {
      open: false,
      sessionId: undefined,
      inputActions: undefined,
      /** Live composer phase, kept current while the sheet is open. */
      phase: undefined,
      /** Draft attachment count, used to confirm the paste fallback landed. */
      attachments: 0,
      listeners: new Set(),
    }

    function publishSheet() {
      SHEET.listeners.forEach(function (listener) {
        try {
          listener()
        } catch (error) {
          // One broken listener must not keep the sheet from opening or closing.
        }
      })
    }

    function openSheet(sessionId, inputActions, phase, attachments) {
      SHEET.open = true
      SHEET.sessionId = sessionId
      SHEET.inputActions = inputActions
      SHEET.phase = phase
      SHEET.attachments = attachments
      publishSheet()
    }

    function closeSheet() {
      if (!SHEET.open) return
      SHEET.open = false
      SHEET.inputActions = undefined
      publishSheet()
    }

    function useSheet() {
      const [, bump] = useState(0)
      useEffect(function () {
        const listener = function () {
          bump(function (value) {
            return value + 1
          })
        }
        SHEET.listeners.add(listener)
        return function () {
          SHEET.listeners.delete(listener)
        }
      }, [])
      return SHEET
    }

    // ---------------------------------------------------------------------
    // Draft hand-off
    // ---------------------------------------------------------------------

    function conversationOf(ctx) {
      return ctx && typeof ctx.get === 'function' ? ctx.get('conversation') : undefined
    }

    /** Drop staged drafts again when the composer refuses them. */
    function releaseDrafts(ctx, drafts) {
      const conversation = conversationOf(ctx)
      if (!conversation || typeof conversation.releaseDraftAttachments !== 'function') return
      try {
        conversation.releaseDraftAttachments(drafts)
      } catch (error) {
        // Best effort: the attachment registry also releases on Session dispose.
      }
    }

    function draftErrorCode(error) {
      const name = error && error.name ? String(error.name) : ''
      if (name === 'UnsupportedImageMediaTypeError') return 'error.type'
      const message = error && error.message ? String(error.message) : ''
      if (/unsupported/i.test(message)) return 'error.type'
      return 'error.bridge'
    }

    function delay(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms)
      })
    }

    /**
     * Hand one file to the composer's own paste intake. The Harness wires that
     * handler itself, so it keeps working even when a slot does not receive the
     * `inputActions` prop (a mobile shell that re-declares the composer, for
     * example). The dispatched event is a real ClipboardEvent carrying one
     * file; the handler's `preventDefault()` is the acceptance signal.
     */
    async function pasteIntoComposer(file) {
      try {
        if (typeof DataTransfer !== 'function') return false
        const editor =
          document.querySelector('[data-lexical-editor="true"]') ||
          document.querySelector('[contenteditable="true"]')
        if (!editor) return false
        const transfer = new DataTransfer()
        transfer.items.add(file)
        let event
        try {
          event = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
          })
        } catch (error) {
          event = new Event('paste', { bubbles: true, cancelable: true })
        }
        if (!event.clipboardData) {
          Object.defineProperty(event, 'clipboardData', { value: transfer, configurable: true })
        }
        const before = typeof SHEET.attachments === 'number' ? SHEET.attachments : 0
        editor.dispatchEvent(event)
        if (event.defaultPrevented !== true) return false
        // The handler consumes the event even when its own intake refuses, so
        // confirmation is the draft's attachment count actually growing.
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await delay(80)
          if (typeof SHEET.attachments === 'number' && SHEET.attachments > before) return true
        }
        return false
      } catch (error) {
        return false
      }
    }

    /**
     * Stage one browser `File` as a draft attachment of the active Session.
     *
     * The shell's `addAttachments` refuses while a submission is adjudicating or
     * flying, so a refusal is retried briefly before giving up. If the action
     * face is missing entirely, or every retry is refused, the file is handed to
     * the composer's own paste intake instead: that path is wired by the Harness
     * itself and stays independent of the props a slot happens to receive.
     *
     * @returns 'ok' on success, otherwise a copy key describing the failure.
     */
    async function deliverToDraft(ctx, sessionId, inputActions, file) {
      if (typeof sessionId !== 'string' || sessionId.length === 0) return 'error.session'
      const conversation = conversationOf(ctx)
      if (!conversation || typeof conversation.createDrafts !== 'function') return 'error.bridge'

      let drafts
      try {
        drafts = conversation.createDrafts(sessionId, [file])
      } catch (error) {
        return draftErrorCode(error)
      }
      if (!Array.isArray(drafts) || drafts.length === 0) return 'error.bridge'

      const ids = drafts.map(function (draft) {
        return draft && draft.id
      })
      if (ids.some(function (id) { return typeof id !== 'string' })) {
        releaseDrafts(ctx, drafts)
        return 'error.bridge'
      }

      const canAppend = inputActions && typeof inputActions.addAttachments === 'function'
      if (canAppend) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (inputActions.addAttachments(ids)) return 'ok'
          await delay(250)
        }
      }

      releaseDrafts(ctx, drafts)
      if (await pasteIntoComposer(file)) return 'ok'
      return canAppend ? 'error.locked' : 'error.api'
    }

    // ---------------------------------------------------------------------
    // Capture helpers
    // ---------------------------------------------------------------------

    function stopStream(stream) {
      if (!stream || typeof stream.getTracks !== 'function') return
      try {
        stream.getTracks().forEach(function (track) {
          try {
            track.stop()
          } catch (error) {
            // Already stopped.
          }
        })
      } catch (error) {
        // Nothing else to release.
      }
    }

    function pad(value) {
      return String(value).padStart(2, '0')
    }

    /** Last camera picked in this browser, '' when the host should choose. */
    function readPreferredDevice() {
      try {
        return window.localStorage.getItem(DEVICE_KEY) || ''
      } catch (error) {
        return ''
      }
    }

    function writePreferredDevice(deviceId) {
      try {
        if (deviceId) window.localStorage.setItem(DEVICE_KEY, deviceId)
        else window.localStorage.removeItem(DEVICE_KEY)
      } catch (error) {
        // Private mode or a blocked storage partition: the choice stays in memory.
      }
    }

    /**
     * The Electron desktop shell installs a media permission handler that
     * accepts microphone requests only, so video capture is refused no matter
     * what the page asks for.
     */
    function isDesktopShell() {
      try {
        return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
      } catch (error) {
        return false
      }
    }

    /** Android hosts route the capture input through their own file chooser. */
    function isAndroidHost() {
      try {
        return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      } catch (error) {
        return false
      }
    }

    function timestampName() {
      const now = new Date()
      return (
        'camera-' +
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '-' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds()) +
        '.jpg'
      )
    }

    function reasonKey(error) {
      const name = error && error.name ? String(error.name) : ''
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        return 'reason.denied'
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        return 'reason.notfound'
      }
      if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
        return 'reason.busy'
      }
      return 'reason.unknown'
    }

    /**
     * Encode the current video frame into a JPEG `File`.
     * Only the frame in memory is touched; nothing is persisted.
     */
    async function encodeFrame(video, mirrored) {
      const sourceWidth = video.videoWidth
      const sourceHeight = video.videoHeight
      if (!sourceWidth || !sourceHeight) throw new Error('frame-not-ready')

      const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight))
      const width = Math.max(1, Math.round(sourceWidth * scale))
      const height = Math.max(1, Math.round(sourceHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas-unavailable')

      if (mirrored) {
        context.translate(width, 0)
        context.scale(-1, 1)
      }
      context.drawImage(video, 0, 0, width, height)

      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(
          function (value) {
            if (value) resolve(value)
            else reject(new Error('encode-failed'))
          },
          'image/jpeg',
          JPEG_QUALITY,
        )
      })

      return new File([blob], timestampName(), { type: 'image/jpeg', lastModified: Date.now() })
    }

    // ---------------------------------------------------------------------
    // Icons (16px stroke set, matching the composer's control weight)
    // ---------------------------------------------------------------------

    function svgProps(size) {
      return {
        viewBox: '0 0 16 16',
        width: size,
        height: size,
        fill: 'none',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      }
    }

    function IconCamera(props) {
      const size = props && props.size ? props.size : 16
      return h(
        'svg',
        svgProps(size),
        h('path', {
          d: 'M3 4.75h2.4l.9-1.4h3.4l.9 1.4H13A1.75 1.75 0 0 1 14.75 6.5v4.5A1.75 1.75 0 0 1 13 12.75H3a1.75 1.75 0 0 1-1.75-1.75V6.5A1.75 1.75 0 0 1 3 4.75Z',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8, cy: 8.65, r: 2.35, stroke: 'currentColor', strokeWidth: 1.25 }),
      )
    }

    function IconClose(props) {
      const size = props && props.size ? props.size : 16
      return h(
        'svg',
        svgProps(size),
        h('path', {
          d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
      )
    }

    function IconAlbum(props) {
      const size = props && props.size ? props.size : 16
      return h(
        'svg',
        svgProps(size),
        h('rect', {
          x: 2.1,
          y: 3.1,
          width: 11.8,
          height: 9.8,
          rx: 1.8,
          stroke: 'currentColor',
          strokeWidth: 1.25,
        }),
        h('circle', { cx: 5.9, cy: 6.4, r: 1.05, fill: 'currentColor' }),
        h('path', {
          d: 'M3.1 11.3l3.2-3.1 2.3 2.2 2.1-1.9 2.2 2.1',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function IconSwitch(props) {
      const size = props && props.size ? props.size : 16
      return h(
        'svg',
        svgProps(size),
        h('path', {
          d: 'M13.1 6.4A5.2 5.2 0 0 0 4 3.7M2.9 9.6A5.2 5.2 0 0 0 12 12.3',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M13.3 3.2v3.3H10M2.7 12.8V9.5H6',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    // ---------------------------------------------------------------------
    // Capture panel
    // ---------------------------------------------------------------------

    function CameraPanel(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const inputActions = props.inputActions
      const onClose = props.onClose

      const tag = useLocaleTag(ctx)
      const t = useMemo(
        function () {
          return makeT(tag)
        },
        [tag],
      )

      const [phase, setPhase] = useState('starting')
      const [facing, setFacing] = useState('environment')
      const [detail, setDetail] = useState('')
      const [busy, setBusy] = useState(false)
      const [devices, setDevices] = useState([])
      const [deviceId, setDeviceId] = useState(readPreferredDevice)
      const [attempt, setAttempt] = useState(0)
      const [copied, setCopied] = useState(false)

      const videoRef = useRef(null)
      const streamRef = useRef(null)
      const systemInputRef = useRef(null)
      const albumInputRef = useRef(null)

      // Start and stop the preview stream with the panel's lifetime.
      useEffect(
        function () {
          let cancelled = false
          const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
          if (!media || typeof media.getUserMedia !== 'function') {
            setPhase('unsupported')
            return function () {
              cancelled = true
            }
          }

          setPhase('starting')
          setDetail('')

          const videoConstraints = deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1440 } }
            : { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }

          media
            .getUserMedia({ audio: false, video: videoConstraints })
            .then(function (stream) {
              if (cancelled) {
                stopStream(stream)
                return
              }
              streamRef.current = stream
              const video = videoRef.current
              if (video) {
                video.srcObject = stream
                const played = video.play()
                if (played && typeof played.catch === 'function') {
                  played.catch(function () {
                    // Autoplay refusal leaves a still frame; capture still works.
                  })
                }
              }
              setPhase('live')
              if (typeof media.enumerateDevices === 'function') {
                media
                  .enumerateDevices()
                  .then(function (list) {
                    if (cancelled) return
                    const cameras = []
                    list.forEach(function (device) {
                      if (device.kind !== 'videoinput') return
                      cameras.push({
                        id: device.deviceId,
                        label: device.label || 'Camera ' + (cameras.length + 1),
                      })
                    })
                    setDevices(cameras)
                  })
                  .catch(function () {
                    // Hosts that hide the device list simply get no picker.
                  })
              }
            })
            .catch(function (error) {
              if (cancelled) return
              if (deviceId && error && error.name === 'OverconstrainedError') {
                // The remembered camera is gone: fall back to the default one.
                writePreferredDevice('')
                setDeviceId('')
                return
              }
              setDetail(reasonKey(error))
              setPhase('blocked')
            })

          return function () {
            cancelled = true
            stopStream(streamRef.current)
            streamRef.current = null
          }
        },
        [attempt, deviceId, facing, sessionId],
      )

      // Escape closes the panel before anything else consumes it.
      useEffect(
        function () {
          const onKeyDown = function (event) {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            onClose()
          }
          window.addEventListener('keydown', onKeyDown, true)
          return function () {
            window.removeEventListener('keydown', onKeyDown, true)
          }
        },
        [onClose],
      )

      // Hold the page behind the sheet still while it is open.
      useEffect(function () {
        const body = document.body
        if (!body) return undefined
        const previous = body.style.overflow
        body.style.overflow = 'hidden'
        return function () {
          body.style.overflow = previous
        }
      }, [])

      // Note: the panel deliberately survives the page being hidden. Opening the
      // system camera or the album backgrounds the page, and unmounting here
      // would discard the photo that is about to come back through the picker.
      // The stream is released by the preview effect on unmount, on close and
      // when the facing mode changes.

      const shoot = useCallback(async function () {
        const video = videoRef.current
        if (!video || busy || phase !== 'live') return
        setBusy(true)
        setDetail('')
        let code = 'ok'
        try {
          const file = await encodeFrame(video, facing === 'user')
          code = await deliverToDraft(ctx, sessionId, inputActions, file)
        } catch (error) {
          code = 'error.encode'
        } finally {
          setBusy(false)
        }
        if (code === 'ok') onClose()
        else setDetail(code)
      }, [busy, ctx, facing, inputActions, onClose, phase, sessionId])

      const pickFiles = useCallback(
        async function (event) {
          const input = event.currentTarget
          const files = Array.prototype.slice.call(input.files || [])
          input.value = ''
          const file = files.find(function (candidate) {
            return candidate && IMAGE_TYPES.indexOf(candidate.type) !== -1
          })
          if (!file) {
            setDetail('error.type')
            return
          }
          const code = await deliverToDraft(ctx, sessionId, inputActions, file)
          if (code === 'ok') onClose()
          else setDetail(code)
        },
        [ctx, inputActions, onClose, sessionId],
      )

      const openSystemCamera = useCallback(function () {
        if (systemInputRef.current) systemInputRef.current.click()
      }, [])

      const openAlbum = useCallback(function () {
        if (albumInputRef.current) albumInputRef.current.click()
      }, [])

      const onDeviceChange = useCallback(function (event) {
        const next = event.target.value
        setDetail('')
        writePreferredDevice(next)
        setDeviceId(next)
      }, [])

      const retry = useCallback(function () {
        setDetail('')
        setAttempt(function (value) {
          return value + 1
        })
      }, [])

      const copyAddress = useCallback(function () {
        const address = typeof window !== 'undefined' ? window.location.href : ''
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(address).then(
              function () {
                setCopied(true)
              },
              function () {
                // Clipboard denied: the address stays selectable in the hint.
              },
            )
          }
        } catch (error) {
          // Same fallback as above.
        }
      }, [])

      const live = phase === 'live'
      const failureKey = detail || 'stage.blocked'
      const showFailure = phase !== 'live' && phase !== 'starting'
      const errorKey = detail.indexOf('error.') === 0 ? detail : ''
      // `error.locked` names the composer phase it saw, so a stuck shell is
      // reported as a phase instead of a vague "please retry".
      const failureVars =
        failureKey === 'error.locked' || errorKey === 'error.locked'
          ? { phase: SHEET.phase || 'unknown' }
          : undefined

      return h(
        'section',
        {
          className: 'dsha-cam-sheet',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('panel.title'),
          'data-phase': phase,
        },
        h('div', { className: 'dsha-cam-grabber', 'aria-hidden': true }),
        h(
          'header',
          { className: 'dsha-cam-head' },
          h('span', { className: 'dsha-cam-mark' }, h(IconCamera, { size: 15 })),
          h(
            'div',
            { className: 'dsha-cam-headText' },
            h('span', { className: 'dsha-cam-title' }, t('panel.title')),
            h('span', { className: 'dsha-cam-hint' }, t('panel.hint')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsha-cam-iconBtn',
              'aria-label': t('panel.close'),
              title: t('panel.close'),
              onClick: onClose,
            },
            h(IconClose, { size: 16 }),
          ),
        ),
        devices.length > 1
          ? h(
              'div',
              { className: 'dsha-cam-devices' },
              h('span', { className: 'dsha-cam-devicesLabel' }, t('camera.label')),
              h(
                'select',
                {
                  className: 'dsha-cam-select',
                  'aria-label': t('camera.label'),
                  value: deviceId,
                  onChange: onDeviceChange,
                },
                h('option', { value: '' }, t('camera.auto')),
                devices.map(function (device) {
                  return h('option', { key: device.id, value: device.id }, device.label)
                }),
              ),
            )
          : null,
        h(
          'div',
          { className: 'dsha-cam-stage', 'data-phase': phase },
          h('video', {
            ref: videoRef,
            className: 'dsha-cam-video' + (facing === 'user' ? ' is-mirrored' : ''),
            autoPlay: true,
            playsInline: true,
            muted: true,
          }),
          phase === 'live'
            ? null
            : h(
                'div',
                { className: 'dsha-cam-stageNote' },
                h(
                  'p',
                  { className: 'dsha-cam-stageText' },
                  phase === 'starting'
                    ? t('stage.starting')
                    : phase === 'unsupported'
                      ? t('stage.unsupported')
                      : t(failureKey, failureVars),
                ),
                showFailure
                  ? h('p', { className: 'dsha-cam-stageText is-dim' }, t('stage.useFallback'))
                  : null,
                showFailure && isDesktopShell()
                  ? h('p', { className: 'dsha-cam-stageText is-dim' }, t('stage.desktopShell'))
                  : null,
                showFailure && isAndroidHost() && !isDesktopShell()
                  ? h('p', { className: 'dsha-cam-stageText is-dim' }, t('stage.pickerHint'))
                  : null,
                showFailure
                  ? h(
                      'div',
                      { className: 'dsha-cam-stageActions' },
                      h(
                        'button',
                        { type: 'button', className: 'dsha-cam-pill', onClick: retry },
                        h(IconSwitch, { size: 14 }),
                        h('span', null, t('retry')),
                      ),
                      isDesktopShell()
                        ? null
                        : h(
                            'button',
                            { type: 'button', className: 'dsha-cam-pill', onClick: openSystemCamera },
                            h(IconCamera, { size: 14 }),
                            h('span', null, t('system')),
                          ),
                      h(
                        'button',
                        { type: 'button', className: 'dsha-cam-pill', onClick: openAlbum },
                        h(IconAlbum, { size: 14 }),
                        h('span', null, t('album')),
                      ),
                      isDesktopShell()
                        ? h(
                            'button',
                            { type: 'button', className: 'dsha-cam-pill', onClick: copyAddress },
                            h('span', null, copied ? t('copied') : t('copyAddress')),
                          )
                        : null,
                    )
                  : null,
              ),
        ),
        h(
          'footer',
          { className: 'dsha-cam-foot' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsha-cam-iconBtn is-wide',
              'aria-label': t('album'),
              title: t('album'),
              onClick: openAlbum,
            },
            h(IconAlbum, { size: 19 }),
          ),
          h('button', {
            type: 'button',
            className: 'dsha-cam-shutter',
            'aria-label': t('shutter'),
            title: t('shutter'),
            disabled: !live || busy,
            onClick: shoot,
          }),
          devices.length > 1
            ? h('span', { className: 'dsha-cam-spacer', 'aria-hidden': true })
            : h(
                'button',
                {
                  type: 'button',
                  className: 'dsha-cam-iconBtn is-wide',
                  'aria-label': t('flip'),
                  title: t('flip'),
                  disabled: !live,
                  onClick: function () {
                    setFacing(function (current) {
                      return current === 'environment' ? 'user' : 'environment'
                    })
                  },
                },
                h(IconSwitch, { size: 19 }),
              ),
        ),
        errorKey
          ? h(
              'p',
              { className: 'dsha-cam-error', role: 'alert' },
              t(errorKey, failureVars),
            )
          : null,
        h('input', {
          ref: systemInputRef,
          className: 'dsha-cam-file',
          type: 'file',
          accept: 'image/*',
          capture: 'environment',
          tabIndex: -1,
          'aria-hidden': true,
          onChange: pickFiles,
        }),
        h('input', {
          ref: albumInputRef,
          className: 'dsha-cam-file',
          type: 'file',
          accept: 'image/*',
          tabIndex: -1,
          'aria-hidden': true,
          onChange: pickFiles,
        }),
      )
    }

    // ---------------------------------------------------------------------
    // Slot entries
    // ---------------------------------------------------------------------

    function CameraTrigger(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const tag = useLocaleTag(ctx)
      const t = useMemo(
        function () {
          return makeT(tag)
        },
        [tag],
      )
      const sheet = useSheet()

      // Live composer phase: the shell refuses attachments while it adjudicates
      // or submits, and that refusal is otherwise indistinguishable from a
      // missing action face.
      const useInput = props.useInput
      const phase =
        typeof useInput === 'function'
          ? useInput(function (state) {
              return state && state.phase
            })
          : undefined
      const attachments =
        typeof useInput === 'function'
          ? useInput(function (state) {
              return state && state.attachmentIds ? state.attachmentIds.length : 0
            })
          : 0

      // Switching Session closes a sheet that belongs to the previous one.
      useEffect(
        function () {
          if (SHEET.open && SHEET.sessionId !== sessionId) closeSheet()
        },
        [sessionId],
      )

      // Keep the sheet's copy of the inputs as fresh as the composer itself.
      useEffect(
        function () {
          if (!SHEET.open || SHEET.sessionId !== sessionId) return
          SHEET.phase = phase
          SHEET.attachments = typeof attachments === 'number' ? attachments : 0
        },
        [attachments, phase, sessionId],
      )

      useEffect(
        function () {
          if (!SHEET.open || SHEET.sessionId !== sessionId) return
          if (props.inputActions) SHEET.inputActions = props.inputActions
        },
        [props.inputActions, sessionId],
      )

      const open = sheet.open && sheet.sessionId === sessionId
      const toggle = useCallback(
        function () {
          if (SHEET.open && SHEET.sessionId === sessionId) closeSheet()
          else openSheet(sessionId, props.inputActions, phase, attachments)
        },
        [attachments, phase, props.inputActions, sessionId],
      )

      return h(
        'button',
        {
          type: 'button',
          className: 'dsha-cam-trigger',
          'aria-label': t('trigger.open'),
          'aria-pressed': open ? 'true' : 'false',
          'aria-expanded': open ? 'true' : 'false',
          title: t('trigger.open'),
          onClick: toggle,
        },
        h(IconCamera, { size: 16 }),
      )
    }

    /**
     * Frame-wide overlay entry: scrim plus the bottom sheet. It carries no
     * Session props of its own, so the trigger hands the active Session and
     * its `inputActions` over when it opens the sheet.
     */
    function CameraOverlay(props) {
      const sheet = useSheet()
      if (!sheet.open || sheet.sessionId === undefined) return null
      return h(
        'div',
        { className: 'dsha-cam-layer' },
        h('div', {
          className: 'dsha-cam-scrim',
          'aria-hidden': true,
          onClick: closeSheet,
        }),
        h(CameraPanel, {
          ctx: props.ctx,
          sessionId: sheet.sessionId,
          inputActions: sheet.inputActions,
          onClose: closeSheet,
        }),
      )
    }

    // ---------------------------------------------------------------------
    // Styles (theme tokens only; the viewfinder backdrop is artwork)
    // ---------------------------------------------------------------------

    const CSS = [
      '.dsha-cam-trigger{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:none;border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-selector,var(--dsw-alias-bg-layer-2));corner-shape:round;transition:background-color .1s}',
      '.dsha-cam-trigger:hover{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-2))}',
      '.dsha-cam-trigger[aria-pressed="true"]{color:var(--dsw-alias-brand-primary)}',
      '.dsha-cam-trigger:focus-visible,.dsha-cam-iconBtn:focus-visible,.dsha-cam-pill:focus-visible,.dsha-cam-shutter:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dsha-cam-layer{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;pointer-events:auto}',
      '.dsha-cam-scrim{position:absolute;inset:0;background:rgba(0,0,0,.42)}',
      '.dsha-cam-sheet{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-bottom:none;border-radius:18px 18px 0 0;box-shadow:0 -10px 36px rgba(0,0,0,.32);overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0px)}',
      '.dsha-cam-grabber{width:36px;height:4px;flex:none;margin:8px auto 0;border-radius:999px;background:var(--dsw-alias-border-l2)}',
      '.dsha-cam-head{display:flex;align-items:center;gap:8px;flex:none;padding:8px 10px 6px}',
      '.dsha-cam-mark{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:8px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}',
      '.dsha-cam-headText{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.dsha-cam-title{font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary)}',
      '.dsha-cam-hint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsha-cam-devices{display:flex;align-items:center;gap:8px;flex:none;padding:0 12px 8px}',
      '.dsha-cam-devicesLabel{flex:none;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.dsha-cam-select{flex:1;min-width:0;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
      '.dsha-cam-spacer{width:44px;height:44px;flex:none}',
      '.dsha-cam-iconBtn{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:none;border-radius:999px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;margin-left:auto}',
      '.dsha-cam-iconBtn.is-wide{width:44px;height:44px;margin-left:0}',
      '.dsha-cam-iconBtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsha-cam-iconBtn:disabled{opacity:.4;cursor:default}',
      '.dsha-cam-stage{position:relative;flex:0 1 auto;margin:2px 10px 0;height:min(44vh,400px);min-height:120px;border-radius:12px;overflow:hidden;background:#0a0c10}',
      '.dsha-cam-video{width:100%;height:100%;display:block;object-fit:cover;background:#0a0c10}',
      '.dsha-cam-video.is-mirrored{transform:scaleX(-1)}',
      '.dsha-cam-stage[data-phase="starting"] .dsha-cam-video,.dsha-cam-stage[data-phase="blocked"] .dsha-cam-video,.dsha-cam-stage[data-phase="unsupported"] .dsha-cam-video{visibility:hidden}',
      '.dsha-cam-stageNote{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;text-align:center}',
      '.dsha-cam-stageText{margin:0;max-width:34ch;font-size:12.5px;line-height:19px;color:#ccd2dc}',
      '.dsha-cam-stageText.is-dim{color:#8f97a4}',
      '.dsha-cam-stageActions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:4px}',
      '.dsha-cam-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.08);color:#eef1f6;font-size:12px;line-height:16px;cursor:pointer}',
      '.dsha-cam-pill:hover{background:rgba(255,255,255,.16)}',
      '.dsha-cam-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;padding:10px 18px 12px}',
      '.dsha-cam-shutter{width:54px;height:54px;flex:none;display:grid;place-items:center;padding:0;border:3px solid var(--dsw-alias-border-l2);border-radius:50%;background:transparent;cursor:pointer}',
      '.dsha-cam-shutter::after{content:"";display:block;width:38px;height:38px;border-radius:50%;background:var(--dsw-alias-label-primary)}',
      '.dsha-cam-shutter:hover:not(:disabled)::after{transform:scale(.94)}',
      '.dsha-cam-shutter:disabled{opacity:.45;cursor:default}',
      '.dsha-cam-error{margin:0 12px 10px;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary)}',
      '.dsha-cam-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
      '@media (max-width:560px){.dsha-cam-sheet{max-height:94vh}.dsha-cam-stage{height:min(42vh,360px);margin:2px 8px 0}.dsha-cam-foot{padding:8px 14px 10px}.dsha-cam-shutter{width:52px;height:52px}.dsha-cam-shutter::after{width:36px;height:36px}}',
    ].join('')

    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(function () {
          const style = document.createElement('style')
          style.setAttribute('data-dsha-camera', '')
          style.textContent = CSS
          document.head.appendChild(style)
          return function () {
            style.remove()
          }
        }, 'dsha-camera: styles')

        ctx.slots.inject('conversation.input.left', function () {
          return ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: 'dsha-camera-trigger',
              order: 10,
            },
            function CameraTriggerSlot(props) {
              return h(CameraTrigger, { ctx: ctx, sessionId: props.sessionId })
            },
          )
        })

        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsha-camera-sheet',
              order: 50,
            },
            function CameraOverlaySlot() {
              return h(CameraOverlay, { ctx: ctx })
            },
          )
        })
      },
    }
  },
})
