import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  CONSOLE_TYPES,
  CONSOLE_TYPE_OPTIONS,
  DEFAULT_CONSOLE_TYPE,
  isKnownConsoleType,
  loadPreferredConsoleType,
  savePreferredConsoleType
} from '@/utils/consoleTypes'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CONSOLE_TYPE_OPTIONS', () => {
  it('offers both noVNC and xterm.js', () => {
    expect(CONSOLE_TYPE_OPTIONS.map(o => o.value)).toEqual(['NOVNC', 'SERIAL'])
  })

  it('labels the serial option xterm.js, the way Proxmox does', () => {
    const serial = CONSOLE_TYPE_OPTIONS.find(o => o.value === CONSOLE_TYPES.SERIAL)
    expect(serial.label).toBe('xterm.js')
  })

  it('defaults to noVNC, so nothing changes for existing users', () => {
    expect(DEFAULT_CONSOLE_TYPE).toBe('NOVNC')
  })

  it('only offers types the API accepts', () => {
    for (const option of CONSOLE_TYPE_OPTIONS) {
      expect(isKnownConsoleType(option.value)).toBe(true)
    }
  })
})

describe('isKnownConsoleType', () => {
  it('accepts the known types in any case', () => {
    expect(isKnownConsoleType('SERIAL')).toBe(true)
    expect(isKnownConsoleType('serial')).toBe(true)
    expect(isKnownConsoleType('NOVNC')).toBe(true)
    expect(isKnownConsoleType('novnc')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isKnownConsoleType('spice')).toBe(false)
    expect(isKnownConsoleType('xtermjs')).toBe(false)
    expect(isKnownConsoleType('')).toBe(false)
    expect(isKnownConsoleType(undefined)).toBe(false)
    expect(isKnownConsoleType(null)).toBe(false)
  })
})

describe('loadPreferredConsoleType', () => {
  it('defaults to noVNC when nothing was saved', () => {
    expect(loadPreferredConsoleType('inst-1')).toBe('NOVNC')
  })

  it('returns what was saved for that instance', () => {
    savePreferredConsoleType('inst-1', 'SERIAL')
    expect(loadPreferredConsoleType('inst-1')).toBe('SERIAL')
  })

  it('keeps the choice separate per instance', () => {
    savePreferredConsoleType('inst-1', 'SERIAL')
    expect(loadPreferredConsoleType('inst-2')).toBe('NOVNC')
  })

  it('ignores a stored value that is no longer a valid type', () => {
    window.localStorage.setItem('wiretap.consoleType.inst-1', 'TELNET')
    expect(loadPreferredConsoleType('inst-1')).toBe('NOVNC')
  })

  it('normalizes a stored lowercase value', () => {
    window.localStorage.setItem('wiretap.consoleType.inst-1', 'serial')
    expect(loadPreferredConsoleType('inst-1')).toBe('SERIAL')
  })

  it('defaults when no instance id is given', () => {
    expect(loadPreferredConsoleType(undefined)).toBe('NOVNC')
    expect(loadPreferredConsoleType('')).toBe('NOVNC')
  })

  it('falls back to the default when localStorage throws', () => {
    // Private browsing / blocked site data.
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(loadPreferredConsoleType('inst-1')).toBe('NOVNC')
  })
})

describe('savePreferredConsoleType', () => {
  it('writes an instance-scoped key', () => {
    savePreferredConsoleType('inst-9', 'SERIAL')
    expect(window.localStorage.getItem('wiretap.consoleType.inst-9')).toBe('SERIAL')
  })

  it('uppercases what it stores', () => {
    savePreferredConsoleType('inst-9', 'serial')
    expect(window.localStorage.getItem('wiretap.consoleType.inst-9')).toBe('SERIAL')
  })

  it('refuses to store an unknown type', () => {
    savePreferredConsoleType('inst-9', 'telnet')
    expect(window.localStorage.getItem('wiretap.consoleType.inst-9')).toBeNull()
  })

  it('does nothing without an instance id', () => {
    expect(() => savePreferredConsoleType('', 'SERIAL')).not.toThrow()
    expect(window.localStorage.length).toBe(0)
  })

  it('does not throw when localStorage is unwritable', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    expect(() => savePreferredConsoleType('inst-9', 'SERIAL')).not.toThrow()
  })

  it('round-trips through load', () => {
    for (const type of ['NOVNC', 'SERIAL']) {
      savePreferredConsoleType('inst-rt', type)
      expect(loadPreferredConsoleType('inst-rt')).toBe(type)
    }
  })
})
