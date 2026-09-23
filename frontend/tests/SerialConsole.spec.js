import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// xterm needs a real canvas/renderer, so the terminal itself is stubbed and we
// assert on what the component tells it to do.
const terminals = []

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    constructor(options) {
      this.options = options
      // What FitAddon would have worked out from the pane; the real addon sets
      // these, and syncSize reports them to the guest.
      this.cols = 245
      this.rows = 55
      this.written = []
      this.dataHandlers = []
      this.disposed = false
      this.opened = null
      this.addons = []
      terminals.push(this)
    }
    loadAddon(addon) { this.addons.push(addon) }
    open(el) { this.opened = el }
    write(chunk) { this.written.push(chunk) }
    /** What the component wrote, decoded the way real xterm would. */
    get decoded() {
      const decoder = new TextDecoder()
      return this.written
        .map(c => (typeof c === 'string' ? c : decoder.decode(c, { stream: true })))
        .join('')
    }
    onData(handler) { this.dataHandlers.push(handler) }
    dispose() { this.disposed = true }
    /** Simulate the user typing (or pasting) into the terminal. */
    emitData(data) { this.dataHandlers.forEach(h => h(data)) }
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    constructor() { this.fitCount = 0 }
    fit() { this.fitCount++ }
  }
}))

import SerialConsole from '@/components/SerialConsole.vue'

/** Minimal WebSocket stand-in that records what was sent. */
class FakeWebSocket {
  static instances = []

  constructor(url, protocols) {
    this.url = url
    this.protocols = protocols
    this.readyState = FakeWebSocket.CONNECTING
    this.sent = []
    this.closed = false
    this.binaryType = 'blob'
    this.onopen = null
    this.onclose = null
    this.onerror = null
    this.onmessage = null
    FakeWebSocket.instances.push(this)
  }

  send(data) { this.sent.push(data) }

  close() {
    this.closed = true
    this.readyState = FakeWebSocket.CLOSED
    if (this.onclose) this.onclose({})
  }

  // Test helpers
  open() {
    this.readyState = FakeWebSocket.OPEN
    if (this.onopen) this.onopen({})
  }
  receive(data) {
    if (this.onmessage) this.onmessage({ data })
  }
  fail() {
    if (this.onerror) this.onerror({})
  }
  serverClose() {
    this.readyState = FakeWebSocket.CLOSED
    if (this.onclose) this.onclose({})
  }

  /** What was sent, decoded back into a string. */
  get sentText() {
    const decoder = new TextDecoder()
    return this.sent.map(chunk =>
      typeof chunk === 'string' ? chunk : decoder.decode(chunk)
    ).join('')
  }

  static get last() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  }
}
FakeWebSocket.CONNECTING = 0
FakeWebSocket.OPEN = 1
FakeWebSocket.CLOSING = 2
FakeWebSocket.CLOSED = 3

const URL_A = 'wss://nova.example.org:6083/?token=aaa'
const URL_B = 'wss://nova.example.org:6083/?token=bbb'

const ESC = String.fromCharCode(27)

async function mountConsole(props = {}) {
  const wrapper = mount(SerialConsole, {
    props: { url: URL_A, ...props }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  terminals.length = 0
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SerialConsole - connecting', () => {
  it('opens a socket to the URL it was given', async () => {
    await mountConsole()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.last.url).toBe(URL_A)
  })

  it('negotiates the binary subprotocol websockify expects', async () => {
    await mountConsole()

    expect(FakeWebSocket.last.protocols).toEqual(['binary'])
  })

  it('asks for arraybuffer frames rather than blobs', async () => {
    await mountConsole()

    expect(FakeWebSocket.last.binaryType).toBe('arraybuffer')
  })

  it('shows a connecting notice until the socket opens', async () => {
    const wrapper = await mountConsole()

    expect(wrapper.text()).toContain('Connecting to serial console')
  })

  it('hides the notice once connected', async () => {
    const wrapper = await mountConsole()

    FakeWebSocket.last.open()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Connecting to serial console')
  })

  it('sends nothing on connect, so it cannot answer a prompt on a shared tty', async () => {
    await mountConsole()

    FakeWebSocket.last.open()
    await flushPromises()

    expect(FakeWebSocket.last.sent).toHaveLength(0)
  })

  it('emits its status so the parent can react', async () => {
    const wrapper = await mountConsole()

    FakeWebSocket.last.open()
    await flushPromises()

    expect(wrapper.emitted('status').flat()).toContain('open')
  })
})

describe('SerialConsole - input', () => {
  it('sends typed characters down the socket', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    terminals[0].emitData('whoami\r')

    expect(socket.sentText).toBe('whoami\r')
  })

  it('sends pasted text in one piece, not keystroke by keystroke', async () => {
    // This is the whole point of the feature: the noVNC page types a paste in
    // simulated keystrokes, xterm.js hands it over as one chunk.
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()
    socket.sent.length = 0

    const password = 'S0me-L0ng-Passw0rd-With-$ymbols!'
    terminals[0].emitData(password)

    expect(socket.sent).toHaveLength(1)
    expect(socket.sentText).toBe(password)
  })

  it('encodes what it sends as UTF-8 bytes', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    terminals[0].emitData('é')

    // Byte-level check rather than instanceof: jsdom and node have separate
    // typed-array constructors, so instanceof is unreliable across the boundary.
    expect(ArrayBuffer.isView(socket.sent[0])).toBe(true)
    expect(Array.from(socket.sent[0])).toEqual([0xc3, 0xa9])
  })

  it('drops input while the socket is not open instead of throwing', async () => {
    await mountConsole()

    expect(() => terminals[0].emitData('x')).not.toThrow()
    expect(FakeWebSocket.last.sent).toHaveLength(0)
  })
})

describe('SerialConsole - output', () => {
  it('writes binary frames to the terminal as text', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    socket.receive(new TextEncoder().encode('root@server:~# ').buffer)

    expect(terminals[0].decoded).toContain('root@server:~# ')
  })

  it('writes string frames straight through', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    socket.receive('login: ')

    expect(terminals[0].decoded).toContain('login: ')
  })

  it('preserves control sequences byte for byte', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    const clearScreen = ESC + '[2J' + ESC + '[H'
    socket.receive(new TextEncoder().encode(clearScreen).buffer)

    expect(terminals[0].decoded).toBe(clearScreen)
  })

  it('survives a multi-byte character split across two frames', async () => {
    // The proxy splits the byte stream wherever it likes; decoding each frame
    // as a standalone document would turn this into two replacement chars.
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    const bytes = new TextEncoder().encode('na\u00efve')
    socket.receive(bytes.slice(0, 3).buffer)
    socket.receive(bytes.slice(3).buffer)

    expect(terminals[0].decoded).toBe('na\u00efve')
  })

  it('handles multi-byte UTF-8 in the stream', async () => {
    await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    socket.receive(new TextEncoder().encode('naïve').buffer)

    expect(terminals[0].decoded).toBe('naïve')
  })
})

describe('SerialConsole - failures', () => {
  it('reports a closed session and offers a reconnect', async () => {
    const wrapper = await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    socket.serverClose()
    await flushPromises()

    expect(wrapper.text()).toContain('disconnected')
    expect(wrapper.text()).toContain('Reconnect')
  })

  it('explains that another session may hold the port on error', async () => {
    // Nova's serial console is single-session; a second viewer lands here.
    const wrapper = await mountConsole()

    FakeWebSocket.last.fail()
    await flushPromises()

    expect(wrapper.text()).toMatch(/another session/i)
  })

  it('keeps the error message rather than downgrading it to "closed"', async () => {
    const wrapper = await mountConsole()
    const socket = FakeWebSocket.last

    socket.fail()
    socket.serverClose()
    await flushPromises()

    expect(wrapper.text()).toMatch(/another session/i)
  })

  // A serial getty prints its banner once, at boot. Attaching afterwards lands
  // on a silent tty, and without a hint the pane just looks broken.
  it('hints to press Enter while the tty has said nothing', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    expect(wrapper.text()).toMatch(/press enter/i)
  })

  it('drops the hint as soon as the first byte arrives', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()
    FakeWebSocket.last.receive('ubuntu login: ')
    await flushPromises()

    expect(wrapper.text()).not.toMatch(/press enter/i)
  })

  // Nova's console tokens are single-use, so the URL we were handed is spent
  // the moment the first socket used it. Reconnecting has to go back to the
  // API for a new one, which only the parent can do.
  it('asks the parent for a fresh console rather than redialling a spent token', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.serverClose()
    await flushPromises()

    await wrapper.find('[data-serial-reconnect]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('reconnect')).toHaveLength(1)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

// Nothing carries a window size over a serial line, so the guest stays at its
// getty's 80x24 and vim draws into the corner of a wide pane. The only cure is
// running stty on the far end, which is typing at the prompt - so it happens
// when asked and never on its own.
describe('SerialConsole - telling the guest its size', () => {
  it('sends stty with the terminal size the fit addon settled on', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    expect(wrapper.vm.syncSize()).toBe(true)
    expect(FakeWebSocket.last.sentText).toBe('stty rows 55 cols 245\r')
  })

  it('ends the command with a carriage return, which is what Enter sends', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    wrapper.vm.syncSize()

    expect(FakeWebSocket.last.sentText.endsWith('\r')).toBe(true)
    expect(FakeWebSocket.last.sentText).not.toContain('\n')
  })

  it('reports the size the terminal actually has, not a fixed guess', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    terminals[0].cols = 120
    terminals[0].rows = 30
    wrapper.vm.syncSize()

    expect(FakeWebSocket.last.sentText).toBe('stty rows 30 cols 120\r')
  })

  it('says so rather than throwing when the socket is not open', async () => {
    const wrapper = await mountConsole()

    expect(wrapper.vm.syncSize()).toBe(false)
    expect(FakeWebSocket.last.sent).toHaveLength(0)
  })

  it('sends nothing on its own - not on connect, not on resize', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    window.dispatchEvent(new Event('resize'))
    await flushPromises()

    expect(FakeWebSocket.last.sent).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('SerialConsole - lifecycle', () => {
  it('reconnects when the URL changes, as it does on refresh', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()

    await wrapper.setProps({ url: URL_B })
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(FakeWebSocket.last.url).toBe(URL_B)
  })

  it('closes the old socket before opening the new one', async () => {
    const wrapper = await mountConsole()
    const first = FakeWebSocket.last
    first.open()
    await flushPromises()

    await wrapper.setProps({ url: URL_B })
    await flushPromises()

    expect(first.closed).toBe(true)
  })

  it('does not reconnect when the URL is set to the same value', async () => {
    const wrapper = await mountConsole()
    await wrapper.setProps({ url: URL_A })
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('closes the socket and disposes the terminal on unmount', async () => {
    const wrapper = await mountConsole()
    const socket = FakeWebSocket.last
    socket.open()
    await flushPromises()

    wrapper.unmount()

    expect(socket.closed).toBe(true)
    expect(terminals[0].disposed).toBe(true)
  })

  it('does not flag a disconnect when we are the ones closing', async () => {
    const wrapper = await mountConsole()
    FakeWebSocket.last.open()
    await flushPromises()
    const statuses = wrapper.emitted('status').flat()

    wrapper.unmount()

    // Tearing down must not emit 'closed' on the way out.
    expect(statuses[statuses.length - 1]).toBe('open')
    expect(statuses).not.toContain('closed')
  })

  it('passes the font size through to the terminal', async () => {
    await mountConsole({ fontSize: 18 })

    expect(terminals[0].options.fontSize).toBe(18)
  })

  it('keeps scrollback so a late joiner can read back', async () => {
    await mountConsole()

    expect(terminals[0].options.scrollback).toBeGreaterThanOrEqual(1000)
  })
})
