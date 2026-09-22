import { describe, it, expect } from 'vitest';

const {
  CONSOLE_TYPE_MAP,
  DEFAULT_CONSOLE_TYPE,
  normalizeConsoleType,
  isSupportedConsoleType,
  mapConsoleType,
  isNovncConsole,
  forceSecureScheme,
  normalizeConsoleUrl
} = require('../utils/console');

describe('normalizeConsoleType', () => {
  it('passes through the canonical names', () => {
    for (const name of Object.keys(CONSOLE_TYPE_MAP)) {
      expect(normalizeConsoleType(name)).toBe(name);
    }
  });

  it('is case insensitive', () => {
    expect(normalizeConsoleType('serial')).toBe('SERIAL');
    expect(normalizeConsoleType('Serial')).toBe('SERIAL');
    expect(normalizeConsoleType('sErIaL')).toBe('SERIAL');
    expect(normalizeConsoleType('novnc')).toBe('NOVNC');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeConsoleType('  serial ')).toBe('SERIAL');
    expect(normalizeConsoleType('\tvnc\n')).toBe('VNC');
  });

  it('falls back to the default for unknown values', () => {
    expect(normalizeConsoleType('telnet')).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType('')).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType('xterm')).toBe(DEFAULT_CONSOLE_TYPE);
  });

  it('falls back to the default for non-strings', () => {
    expect(normalizeConsoleType(undefined)).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType(null)).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType(42)).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType({})).toBe(DEFAULT_CONSOLE_TYPE);
  });

  it('does not treat inherited Object properties as console types', () => {
    expect(normalizeConsoleType('constructor')).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType('toString')).toBe(DEFAULT_CONSOLE_TYPE);
    expect(normalizeConsoleType('__proto__')).toBe(DEFAULT_CONSOLE_TYPE);
  });
});

describe('isSupportedConsoleType', () => {
  it('accepts every mapped type, in any case', () => {
    for (const name of Object.keys(CONSOLE_TYPE_MAP)) {
      expect(isSupportedConsoleType(name)).toBe(true);
      expect(isSupportedConsoleType(name.toLowerCase())).toBe(true);
    }
  });

  it('rejects unknown and non-string values', () => {
    expect(isSupportedConsoleType('xtermjs')).toBe(false);
    expect(isSupportedConsoleType('')).toBe(false);
    expect(isSupportedConsoleType(undefined)).toBe(false);
    expect(isSupportedConsoleType(null)).toBe(false);
    expect(isSupportedConsoleType(7)).toBe(false);
  });

  it('is stricter than normalizeConsoleType', () => {
    // normalize silently falls back; isSupported tells you it was bogus.
    expect(normalizeConsoleType('bogus')).toBe('NOVNC');
    expect(isSupportedConsoleType('bogus')).toBe(false);
  });
});

describe('mapConsoleType', () => {
  it('maps serial to Nova serial', () => {
    expect(mapConsoleType('SERIAL')).toEqual({ protocol: 'serial', type: 'serial' });
  });

  it('maps both VNC spellings to novnc', () => {
    expect(mapConsoleType('VNC')).toEqual({ protocol: 'vnc', type: 'novnc' });
    expect(mapConsoleType('NOVNC')).toEqual({ protocol: 'vnc', type: 'novnc' });
  });

  it('maps the remaining OpenStack console types', () => {
    expect(mapConsoleType('SPICE')).toEqual({ protocol: 'spice', type: 'spice-html5' });
    expect(mapConsoleType('RDP')).toEqual({ protocol: 'rdp', type: 'rdp-html5' });
    expect(mapConsoleType('MKS')).toEqual({ protocol: 'mks', type: 'webmks' });
  });

  it('defaults unknown types to novnc, matching the old switch statement', () => {
    expect(mapConsoleType('nonsense')).toEqual({ protocol: 'vnc', type: 'novnc' });
    expect(mapConsoleType(undefined)).toEqual({ protocol: 'vnc', type: 'novnc' });
  });

  it('always returns both fields', () => {
    for (const name of Object.keys(CONSOLE_TYPE_MAP)) {
      const mapped = mapConsoleType(name);
      expect(typeof mapped.protocol).toBe('string');
      expect(typeof mapped.type).toBe('string');
    }
  });
});

describe('isNovncConsole', () => {
  it('does not classify serial as noVNC', () => {
    expect(isNovncConsole('SERIAL')).toBe(false);
  });

  it('classifies both VNC spellings as noVNC', () => {
    for (const name of ['VNC', 'NOVNC', 'vnc', 'novnc']) {
      expect(isNovncConsole(name)).toBe(true);
    }
  });

  it('does not treat spice/rdp/mks as noVNC', () => {
    for (const name of ['SPICE', 'RDP', 'MKS']) {
      expect(isNovncConsole(name)).toBe(false);
    }
  });

  it('treats unknown types as noVNC, since that is the fallback', () => {
    expect(isNovncConsole('whatever')).toBe(true);
  });
});

describe('forceSecureScheme', () => {
  it('upgrades http to https', () => {
    expect(forceSecureScheme('http://host:6080/vnc.html?token=abc'))
      .toBe('https://host:6080/vnc.html?token=abc');
  });

  it('leaves ws:// alone, because only the browser knows the page scheme', () => {
    // A deployment whose serialproxy has no TLS listener still has to work;
    // Console.vue upgrades this when the page itself is HTTPS.
    expect(forceSecureScheme('ws://host:6083/?token=abc'))
      .toBe('ws://host:6083/?token=abc');
  });

  it('leaves already-secure URLs alone', () => {
    expect(forceSecureScheme('https://host/x')).toBe('https://host/x');
    expect(forceSecureScheme('wss://host/x')).toBe('wss://host/x');
  });

  it('is idempotent', () => {
    const once = forceSecureScheme('http://host:6080/vnc.html?token=abc');
    expect(forceSecureScheme(once)).toBe(once);
  });

  it('only rewrites the scheme, never the rest of the URL', () => {
    // A token containing the literal string "http://" must survive untouched.
    const url = 'http://host/vnc.html?token=http://not-a-scheme';
    expect(forceSecureScheme(url)).toBe('https://host/vnc.html?token=http://not-a-scheme');
  });

  it('passes empty-ish values straight through', () => {
    expect(forceSecureScheme('')).toBe('');
    expect(forceSecureScheme(null)).toBe(null);
    expect(forceSecureScheme(undefined)).toBe(undefined);
  });
});

describe('normalizeConsoleUrl', () => {
  it('secures and scales a noVNC URL', () => {
    expect(normalizeConsoleUrl('http://host:6080/vnc_auto.html?token=abc', 'NOVNC'))
      .toBe('https://host:6080/vnc_auto.html?token=abc&scale=true');
  });

  it('leaves a serial URL untouched, noVNC query params included', () => {
    const out = normalizeConsoleUrl('ws://host:6083/?token=abc', 'SERIAL');
    expect(out).toBe('ws://host:6083/?token=abc');
    expect(out).not.toContain('scale=true');
  });

  it('passes an already-wss serial URL through', () => {
    expect(normalizeConsoleUrl('wss://host:6083/?token=abc', 'SERIAL'))
      .toBe('wss://host:6083/?token=abc');
  });

  it('does not add scale=true twice', () => {
    const url = 'https://host/vnc.html?token=abc&scale=true';
    expect(normalizeConsoleUrl(url, 'NOVNC')).toBe(url);
  });

  it('uses ? when the noVNC URL has no query string yet', () => {
    expect(normalizeConsoleUrl('https://host/vnc.html', 'VNC'))
      .toBe('https://host/vnc.html?scale=true');
  });

  it('is idempotent for both console types', () => {
    for (const [url, type] of [
      ['http://host/vnc.html?token=abc', 'NOVNC'],
      ['ws://host:6083/?token=abc', 'SERIAL']
    ]) {
      const once = normalizeConsoleUrl(url, type);
      expect(normalizeConsoleUrl(once, type)).toBe(once);
    }
  });

  it('passes empty-ish values straight through', () => {
    expect(normalizeConsoleUrl('', 'NOVNC')).toBe('');
    expect(normalizeConsoleUrl(null, 'SERIAL')).toBe(null);
    expect(normalizeConsoleUrl(undefined, 'NOVNC')).toBe(undefined);
  });

  it('does not throw when the console type is missing', () => {
    expect(() => normalizeConsoleUrl('http://host/x', undefined)).not.toThrow();
    expect(normalizeConsoleUrl('http://host/x', undefined)).toContain('https://');
  });

  it('leaves spice URLs secured but otherwise untouched', () => {
    expect(normalizeConsoleUrl('http://host/spice_auto.html?token=abc', 'SPICE'))
      .toBe('https://host/spice_auto.html?token=abc');
  });
});
