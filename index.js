/**
 * dsha-camera — Host half.
 *
 * The plugin is browser-only by design: `getUserMedia`, the frame encode and
 * the draft attachment hand-off all happen in the page (see `client.js`).
 * This row still exists because a bundle is a Host package first: it gives the
 * Loader a stable, inspectable entry and a place to report activation errors
 * next to every other plugin in the profile.
 *
 * No Host service, route, tool or storage is registered, so unloading the row
 * leaves nothing behind.
 */

/** Human-readable row name used by Loader diagnostics. */
export const name = 'dsha-camera'

/**
 * Activate the Host half.
 *
 * Intentionally empty: the camera surface is a Client plugin declared by
 * `dsh.client` in `package.json`. Keep this function so the bundle has a valid
 * Host export and the row activates cleanly.
 */
export function apply() {}
