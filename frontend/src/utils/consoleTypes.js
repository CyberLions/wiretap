/**
 * Console types the UI offers, and the per-instance remembered choice.
 *
 * These names match what the API accepts on
 * GET /instances/:id/console?type=... and what backend/utils/console.js maps
 * to Nova's (protocol, type) pairs.
 */

export const CONSOLE_TYPES = {
  NOVNC: 'NOVNC',
  SERIAL: 'SERIAL'
}

export const DEFAULT_CONSOLE_TYPE = CONSOLE_TYPES.NOVNC

export const CONSOLE_TYPE_OPTIONS = [
  { value: CONSOLE_TYPES.NOVNC, label: 'noVNC' },
  { value: CONSOLE_TYPES.SERIAL, label: 'xterm.js' }
]

const STORAGE_PREFIX = 'wiretap.consoleType.'

/** True if `type` is one of the types this UI knows how to render. */
export function isKnownConsoleType(type) {
  return Object.prototype.hasOwnProperty.call(CONSOLE_TYPES, String(type).toUpperCase())
}

/**
 * The console type last chosen for this instance, defaulting to noVNC.
 * Someone who prefers a text console for a given box should not have to pick
 * it again every time they open it.
 */
export function loadPreferredConsoleType(instanceId) {
  if (!instanceId) return DEFAULT_CONSOLE_TYPE

  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + instanceId)
    if (stored && isKnownConsoleType(stored)) {
      return stored.toUpperCase()
    }
  } catch (err) {
    // Private browsing and blocked site data both throw here; the default is fine.
  }

  return DEFAULT_CONSOLE_TYPE
}

export function savePreferredConsoleType(instanceId, type) {
  if (!instanceId || !isKnownConsoleType(type)) return

  try {
    window.localStorage.setItem(STORAGE_PREFIX + instanceId, String(type).toUpperCase())
  } catch (err) {
    // Not being able to remember the choice is not worth breaking the console over.
  }
}
