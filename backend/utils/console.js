/**
 * Console type helpers.
 *
 * OpenStack exposes several console flavors through the same
 * `POST /servers/{id}/remote-consoles` endpoint, each identified by a
 * (protocol, type) pair. Two of them matter to us:
 *
 *   - NOVNC  -> an http(s) URL pointing at a full noVNC web app, which we can
 *              drop straight into an iframe.
 *   - SERIAL -> a ws(s) URL carrying the raw bytes of the guest serial port.
 *              There is no UI behind it; something on our side has to render
 *              the stream (see SerialConsole.vue / xterm.js).
 *
 * Keeping the mapping and URL fixups here means both getConsoleUrl() and
 * getConsoleUrlForProject() share one implementation instead of two copies.
 */

// Console types we accept from clients, mapped to what Nova calls them.
const CONSOLE_TYPE_MAP = {
  SERIAL: { protocol: 'serial', type: 'serial' },
  SPICE: { protocol: 'spice', type: 'spice-html5' },
  RDP: { protocol: 'rdp', type: 'rdp-html5' },
  MKS: { protocol: 'mks', type: 'webmks' },
  NOVNC: { protocol: 'vnc', type: 'novnc' },
  VNC: { protocol: 'vnc', type: 'novnc' }
};

const DEFAULT_CONSOLE_TYPE = 'NOVNC';

// Types whose URL is a noVNC page, and therefore accept noVNC's query params.
const NOVNC_CONSOLE_TYPES = ['NOVNC', 'VNC'];

/**
 * Normalize whatever a caller passed (`serial`, 'Serial', undefined, ...) into
 * one of the keys of CONSOLE_TYPE_MAP. Unknown values fall back to NOVNC,
 * matching the previous switch-statement behavior.
 */
function normalizeConsoleType(consoleType) {
  if (typeof consoleType !== 'string') return DEFAULT_CONSOLE_TYPE;

  const upper = consoleType.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CONSOLE_TYPE_MAP, upper)
    ? upper
    : DEFAULT_CONSOLE_TYPE;
}

/** True if `consoleType` is one we recognize, without falling back. */
function isSupportedConsoleType(consoleType) {
  if (typeof consoleType !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(
    CONSOLE_TYPE_MAP,
    consoleType.trim().toUpperCase()
  );
}

/** Map a console type to the { protocol, type } Nova expects. */
function mapConsoleType(consoleType) {
  return CONSOLE_TYPE_MAP[normalizeConsoleType(consoleType)];
}

/** True for console types whose URL is a noVNC page. */
function isNovncConsole(consoleType) {
  return NOVNC_CONSOLE_TYPES.includes(normalizeConsoleType(consoleType));
}

/**
 * Upgrade an http:// console URL to https://, so an iframe served from an
 * HTTPS page is not blocked as mixed content.
 *
 * Deliberately leaves ws:// alone. Whether a ws:// serial URL has to become
 * wss:// depends on how the page was served, which only the browser knows -
 * see secureConsoleUrl in Console.vue. Rewriting it here would make a
 * plain-ws deployment (serialproxy without TLS) unreachable with no way out.
 */
function forceSecureScheme(url) {
  if (!url) return url;

  if (url.startsWith('http://')) return 'https://' + url.slice('http://'.length);

  return url;
}

/**
 * Apply every fixup a console URL needs before we hand it to a browser:
 * secure scheme for all types, plus noVNC's auto-scaling for the iframe ones.
 */
function normalizeConsoleUrl(url, consoleType) {
  if (!url) return url;

  let normalized = forceSecureScheme(url);

  if (isNovncConsole(consoleType) && !normalized.includes('scale=true')) {
    normalized += normalized.includes('?') ? '&scale=true' : '?scale=true';
  }

  return normalized;
}

module.exports = {
  CONSOLE_TYPE_MAP,
  DEFAULT_CONSOLE_TYPE,
  normalizeConsoleType,
  isSupportedConsoleType,
  mapConsoleType,
  isNovncConsole,
  forceSecureScheme,
  normalizeConsoleUrl
};
