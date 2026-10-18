/**
 * dsha-camera — Client half (plain browser JavaScript, no build step).
 *
 * What it adds
 * ------------
 * One camera button in the composer tool row, right of the shipped `+`
 * control. Tapping it opens the system camera through
 * `<input type="file" accept="image/*" capture="environment">`; the photo the
 * camera returns goes straight into the draft — the same attachment path the
 * Harness uses for a dropped or pasted image. Long-press opens the album
 * picker instead.
 *
 * Why there is no in-page viewfinder
 * ----------------------------------
 * An earlier version drew a live `getUserMedia` preview inside a sheet. On the
 * target device that stream collapses to about one frame per second a few
 * seconds after it starts (measured: both video elements at 1 fps while the
 * page still rendered at 120 fps), and reopening the camera only restored it
 * for a few seconds. That is the camera HAL, not the page, so the preview was
 * removed rather than shipped broken.
 *
 * Privacy note
 * ------------
 * The plugin itself never writes a file: the bytes live in memory until the
 * user sends the message. Whether the camera app also keeps a copy in the
 * device album is decided by that app; a page cannot prevent it. Only an
 * in-page capture would avoid the camera app entirely.
 */

window.__ModuleLoader__.load({
  id: 'dsha-camera',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** Image MIME types the composer accepts as image drafts. */
    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    /** Long-press delay that switches the button to the album picker. */
    const HOLD_MS = 600

    // ---------------------------------------------------------------------
    // Copy
    // ---------------------------------------------------------------------

    const COPY = {
      zh: {
        'trigger.open': '拍照（长按选相册）',
        'trigger.hint': '单击调用系统相机，长按打开相册',
        'error.bridge': '没找到会话的附件接口，请确认 Harness 版本不低于 0.2.0-rc.2',
        'error.locked': '输入框暂时不接受附件（状态：{phase}），等这次发送结束后再试。',
        'error.api': '当前 Harness 没有向插件暴露附件接口，照片没能放进输入框。',
        'error.type': '只支持 JPEG / PNG / WebP / GIF 图片',
        'error.session': '当前没有可用的会话',
      },
      en: {
        'trigger.open': 'Take a photo (hold for album)',
        'trigger.hint': 'Tap for the system camera, hold for the album',
        'error.bridge': 'The draft attachment API is missing; Harness 0.2.0-rc.2 or newer is required',
        'error.locked': 'The composer is not accepting attachments right now (phase: {phase}). Try again once the current send settles.',
        'error.api': 'This Harness build does not expose the attachment API to plugins, so the photo could not be placed in the draft.',
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
    // Draft hand-off
    // ---------------------------------------------------------------------

    function conversationOf(ctx) {
      return ctx && typeof ctx.get === 'function' ? ctx.get('conversation') : undefined
    }

    function releaseDrafts(ctx, drafts) {
      const conversation = conversationOf(ctx)
      if (!conversation || typeof conversation.releaseDraftAttachments !== 'function') return
      try {
        conversation.releaseDraftAttachments(drafts)
      } catch (error) {
        // Best effort: the attachment registry also releases on Session dispose.
      }
    }

    function delay(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms)
      })
    }

    function draftErrorCode(error) {
      const name = error && error.name ? String(error.name) : ''
      if (name === 'UnsupportedImageMediaTypeError') return 'error.type'
      const message = error && error.message ? String(error.message) : ''
      if (/unsupported/i.test(message)) return 'error.type'
      return 'error.bridge'
    }

    /**
     * Hand one file to the composer's own paste intake. The Harness wires that
     * handler itself, so it keeps working even when a slot does not receive the
     * `inputActions` prop.
     */
    function pasteIntoComposer(file) {
      try {
        if (typeof DataTransfer !== 'function') return false
        const editor =
          document.querySelector('[data-lexical-editor]') ||
          document.querySelector('[contenteditable]') ||
          document.querySelector('[role="textbox"][contenteditable]')
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
        editor.dispatchEvent(event)
        return true
      } catch (error) {
        return false
      }
    }

    /**
     * Stage one browser `File` as a draft attachment of the active Session.
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
      if (pasteIntoComposer(file)) return 'ok'
      return canAppend ? 'error.locked' : 'error.api'
    }

    // ---------------------------------------------------------------------
    // Icon (16px stroke set, matching the composer's control weight)
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

    // ---------------------------------------------------------------------
    // Trigger
    // ---------------------------------------------------------------------

    function CameraTrigger(props) {
      const ctx = props.ctx
      const sessionId = props.sessionId
      const inputActions = props.inputActions
      const tag = useLocaleTag(ctx)
      const t = useMemo(
        function () {
          return makeT(tag)
        },
        [tag],
      )

      const captureRef = useRef(null)
      const albumRef = useRef(null)
      const holdRef = useRef(0)
      const [busy, setBusy] = useState(false)

      useEffect(function () {
        return function () {
          if (holdRef.current) window.clearTimeout(holdRef.current)
        }
      }, [])

      const onPicked = useCallback(
        async function (event) {
          const input = event.currentTarget
          const files = Array.prototype.slice.call(input.files || [])
          input.value = ''
          const file = files.find(function (candidate) {
            return candidate && IMAGE_TYPES.indexOf(candidate.type) !== -1
          })
          if (!file) return
          setBusy(true)
          try {
            await deliverToDraft(ctx, sessionId, inputActions, file)
          } finally {
            setBusy(false)
          }
        },
        [ctx, inputActions, sessionId],
      )

      const openCapture = useCallback(function () {
        if (captureRef.current) captureRef.current.click()
      }, [])

      const openAlbum = useCallback(function () {
        if (albumRef.current) albumRef.current.click()
      }, [])

      const onPointerDown = useCallback(
        function () {
          if (busy) return
          if (holdRef.current) window.clearTimeout(holdRef.current)
          holdRef.current = window.setTimeout(function () {
            holdRef.current = 0
            openAlbum()
          }, HOLD_MS)
        },
        [busy, openAlbum],
      )

      const onPointerUp = useCallback(
        function () {
          if (holdRef.current) {
            window.clearTimeout(holdRef.current)
            holdRef.current = 0
            openCapture()
          }
        },
        [openCapture],
      )

      const cancelHold = useCallback(function () {
        if (holdRef.current) {
          window.clearTimeout(holdRef.current)
          holdRef.current = 0
        }
      }, [])

      const onKeyDown = useCallback(
        function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          openCapture()
        },
        [openCapture],
      )

      return h(
        'span',
        { className: 'dsha-cam-root' },
        h(
          'button',
          {
            type: 'button',
            className: 'dsha-cam-trigger' + (busy ? ' is-busy' : ''),
            'aria-label': t('trigger.open'),
            title: t('trigger.hint'),
            disabled: busy,
            onPointerDown: onPointerDown,
            onPointerUp: onPointerUp,
            onPointerLeave: cancelHold,
            onPointerCancel: cancelHold,
            onKeyDown: onKeyDown,
            onClick: function (event) {
              // The pointer handlers already opened a picker; keep the click
              // from firing a second one on browsers that emit both.
              event.preventDefault()
            },
          },
          h(IconCamera, { size: 16 }),
        ),
        h('input', {
          ref: captureRef,
          className: 'dsha-cam-file',
          type: 'file',
          accept: 'image/*',
          capture: 'environment',
          tabIndex: -1,
          'aria-hidden': true,
          onChange: onPicked,
        }),
        h('input', {
          ref: albumRef,
          className: 'dsha-cam-file',
          type: 'file',
          accept: 'image/*',
          tabIndex: -1,
          'aria-hidden': true,
          onChange: onPicked,
        }),
      )
    }

    // ---------------------------------------------------------------------
    // Styles (theme tokens only)
    // ---------------------------------------------------------------------

    const CSS = [
      '.dsha-cam-root{display:inline-flex;align-items:center}',
      '.dsha-cam-trigger{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:none;border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-primary,#111);background:var(--dsw-specific-selector,var(--dsw-alias-bg-layer-2,#f2f3f5));transition:background-color .1s}',
      '.dsha-cam-trigger:hover{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-2,#f2f3f5))}',
      '.dsha-cam-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#1a73e8);outline-offset:2px}',
      '.dsha-cam-trigger:disabled{opacity:.5;cursor:default}',
      '.dsha-cam-file{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none}',
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
              return h(CameraTrigger, {
                ctx: ctx,
                sessionId: props.sessionId,
                // The composer hands the draft attachment API to this seat;
                // dropping it here reduces every delivery to "no API".
                inputActions: props.inputActions,
              })
            },
          )
        })
      },
    }
  },
})
