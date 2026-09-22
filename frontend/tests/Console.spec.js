import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const getConsole = vi.fn()
const getById = vi.fn()

vi.mock('@/services/api', () => ({
  default: {
    instances: {
      getById: (...args) => getById(...args),
      getConsole: (...args) => getConsole(...args),
      powerOn: vi.fn(),
      powerOff: vi.fn(),
      reboot: vi.fn()
    }
  }
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    user: ref({ id: 'user-1', role: 'USER' }),
    isAuthenticated: ref(true),
    isAdmin: ref(false),
    isUser: ref(true)
  })
}))

vi.mock('@/composables/useInstanceStatusMonitor', () => ({
  useInstanceStatusMonitor: () => ({
    isMonitoring: ref(false),
    currentStatus: ref('active'),
    currentPowerState: ref('running'),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn()
  })
}))

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'inst-1' }, meta: {} }),
  useRouter: () => ({ push })
}))

import Console from '@/views/Console.vue'

const NOVNC_URL = 'https://nova.example.org:6080/vnc_auto.html?token=a&scale=true'
const SERIAL_URL = 'wss://nova.example.org:6083/?token=a'

/**
 * SerialConsole is exercised on its own in SerialConsole.spec.js; here we only
 * care that Console picks it, so it is replaced with a marker component.
 */
const SerialConsoleStub = {
  name: 'SerialConsole',
  props: ['url'],
  emits: ['reconnect'],
  template:
    '<div data-test="serial-console">{{ url }}' +
    '<button data-test="serial-reconnect" @click="$emit(\'reconnect\')"></button>' +
    '</div>'
}

async function mountConsole() {
  const wrapper = mount(Console, {
    global: {
      stubs: {
        SerialConsole: SerialConsoleStub,
        Toast: true
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** The console-type dropdown button in the control bar. */
function typeButton(wrapper) {
  return wrapper.find('button[data-console-type-button]')
}

async function openTypeMenu(wrapper) {
  await typeButton(wrapper).trigger('click')
  await flushPromises()
}

/** Click the menu entry with the given label. */
async function chooseType(wrapper, label) {
  await openTypeMenu(wrapper)
  const option = wrapper
    .findAll('.console-type-menu button')
    .find(b => b.text().includes(label))
  await option.trigger('click')
  await flushPromises()
}

/** Pretend the page was served over `protocol` for the duration of a test. */
function setPageProtocol(protocol) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, protocol },
    writable: true,
    configurable: true
  })
}

const httpsLocation = window.location

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  Object.defineProperty(window, 'location', {
    value: httpsLocation,
    writable: true,
    configurable: true
  })

  getById.mockResolvedValue({
    data: { id: 'inst-1', name: 'team-1-server', status: 'active', locked: false }
  })
  getConsole.mockImplementation((id, type) =>
    Promise.resolve({
      data: {
        console_url: type === 'SERIAL' ? SERIAL_URL : NOVNC_URL,
        console_type: type
      }
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Console - console type picker', () => {
  it('starts on noVNC', async () => {
    const wrapper = await mountConsole()

    expect(typeButton(wrapper).text()).toContain('noVNC')
    expect(getConsole).toHaveBeenCalledWith('inst-1', 'NOVNC')
  })

  it('offers both noVNC and xterm.js', async () => {
    const wrapper = await mountConsole()

    await openTypeMenu(wrapper)
    const labels = wrapper.findAll('.console-type-menu button').map(b => b.text())

    expect(labels.some(l => l.includes('noVNC'))).toBe(true)
    expect(labels.some(l => l.includes('xterm.js'))).toBe(true)
  })

  it('keeps the menu closed until the button is clicked', async () => {
    const wrapper = await mountConsole()

    expect(wrapper.find('.console-type-menu').exists()).toBe(false)
  })

  it('closes the menu after a choice is made', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.find('.console-type-menu').exists()).toBe(false)
  })

  it('requests a serial console when xterm.js is chosen', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(getConsole).toHaveBeenLastCalledWith('inst-1', 'SERIAL')
  })

  it('updates the button label to match the choice', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(typeButton(wrapper).text()).toContain('xterm.js')
  })

  it('does not re-request the console when the same type is chosen again', async () => {
    const wrapper = await mountConsole()
    const callsAfterLoad = getConsole.mock.calls.length

    await chooseType(wrapper, 'noVNC')

    expect(getConsole.mock.calls.length).toBe(callsAfterLoad)
  })

  it('switches back to noVNC', async () => {
    const wrapper = await mountConsole()
    await chooseType(wrapper, 'xterm.js')

    await chooseType(wrapper, 'noVNC')

    expect(getConsole).toHaveBeenLastCalledWith('inst-1', 'NOVNC')
  })
})

describe('Console - rendering the right console', () => {
  it('renders the noVNC iframe by default', async () => {
    const wrapper = await mountConsole()

    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-test="serial-console"]').exists()).toBe(false)
  })

  it('renders xterm.js instead of the iframe for serial', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.find('[data-test="serial-console"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('hands the wss URL to the terminal', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.find('[data-test="serial-console"]').text()).toBe(SERIAL_URL)
  })

  // The token in a console URL is spent once the terminal has dialled it, so a
  // reconnect has to fetch a new one. Redialling the same URL always fails.
  it('fetches a fresh console URL when the terminal asks to reconnect', async () => {
    const wrapper = await mountConsole()
    await chooseType(wrapper, 'xterm.js')
    const callsBefore = getConsole.mock.calls.length

    await wrapper.find('[data-test="serial-reconnect"]').trigger('click')
    await flushPromises()

    expect(getConsole.mock.calls.length).toBe(callsBefore + 1)
    expect(getConsole).toHaveBeenLastCalledWith('inst-1', 'SERIAL')
  })

  it('upgrades a ws:// URL to wss:// on an HTTPS page', async () => {
    getConsole.mockResolvedValue({
      data: { console_url: 'ws://nova.example.org:6083/?token=a', console_type: 'SERIAL' }
    })
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.find('[data-test="serial-console"]').text()).toBe(SERIAL_URL)
  })

  it('leaves ws:// alone on an HTTP page, so local dev still connects', async () => {
    // A serialproxy with no TLS listener is a normal deployment; forcing
    // wss:// there would make the console permanently unreachable.
    setPageProtocol('http:')
    getConsole.mockResolvedValue({
      data: { console_url: 'ws://nova.example.org:6083/?token=a', console_type: 'SERIAL' }
    })
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.find('[data-test="serial-console"]').text())
      .toBe('ws://nova.example.org:6083/?token=a')
  })

  it('still upgrades an http:// noVNC URL regardless of page scheme', async () => {
    getConsole.mockResolvedValue({
      data: {
        console_url: 'http://nova.example.org:6080/vnc_auto.html?token=a',
        console_type: 'NOVNC'
      }
    })
    const wrapper = await mountConsole()

    expect(wrapper.find('iframe').attributes('src')).toMatch(/^https:/)
  })

  it('goes back to the iframe when noVNC is reselected', async () => {
    const wrapper = await mountConsole()
    await chooseType(wrapper, 'xterm.js')

    await chooseType(wrapper, 'noVNC')

    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-test="serial-console"]').exists()).toBe(false)
  })
})

describe('Console - remembering the choice', () => {
  it('saves the choice for that instance', async () => {
    const wrapper = await mountConsole()

    await chooseType(wrapper, 'xterm.js')

    expect(window.localStorage.getItem('wiretap.consoleType.inst-1')).toBe('SERIAL')
  })

  it('opens on the remembered type next time', async () => {
    window.localStorage.setItem('wiretap.consoleType.inst-1', 'SERIAL')

    const wrapper = await mountConsole()

    expect(typeButton(wrapper).text()).toContain('xterm.js')
    expect(getConsole).toHaveBeenCalledWith('inst-1', 'SERIAL')
  })

  it('ignores a remembered type that is no longer valid', async () => {
    window.localStorage.setItem('wiretap.consoleType.inst-1', 'SPICE')

    const wrapper = await mountConsole()

    expect(typeButton(wrapper).text()).toContain('noVNC')
    expect(getConsole).toHaveBeenCalledWith('inst-1', 'NOVNC')
  })
})

describe('Console - when the console cannot be opened', () => {
  it('renders neither console when the request fails', async () => {
    getConsole.mockRejectedValue({ response: { status: 502, data: { error: 'nope' } } })

    const wrapper = await mountConsole()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-test="serial-console"]').exists()).toBe(false)
  })

  it('surfaces the server message when serial is unavailable', async () => {
    const wrapper = await mountConsole()
    getConsole.mockRejectedValue({
      response: {
        status: 502,
        data: { error: 'Could not get a SERIAL console for this instance' }
      }
    })

    await chooseType(wrapper, 'xterm.js')

    expect(wrapper.vm.toast.show).toBe(true)
    expect(wrapper.vm.toast.message).toMatch(/SERIAL console/i)
    expect(wrapper.vm.toast.type).toBe('error')
  })

  it('leaves the picker on the failed type so the user can switch back', async () => {
    const wrapper = await mountConsole()
    getConsole.mockRejectedValue({ response: { status: 502, data: { error: 'nope' } } })

    await chooseType(wrapper, 'xterm.js')

    expect(typeButton(wrapper).text()).toContain('xterm.js')
  })
})

describe('Console - powered-off instances', () => {
  beforeEach(() => {
    getById.mockResolvedValue({
      data: { id: 'inst-1', name: 'team-1-server', status: 'shutoff', locked: false }
    })
  })

  it('does not request a console for a powered-off VM', async () => {
    await mountConsole()

    expect(getConsole).not.toHaveBeenCalled()
  })

  it('disables the picker rather than letting it produce a misleading error', async () => {
    const wrapper = await mountConsole()

    expect(typeButton(wrapper).attributes('disabled')).toBeDefined()
  })
})

describe('Console - picker label', () => {
  it('shows a human label, never the raw type key', async () => {
    const wrapper = await mountConsole()

    expect(typeButton(wrapper).text()).not.toContain('NOVNC')
    expect(typeButton(wrapper).text()).toContain('noVNC')
  })

  it('falls back to a human label if the stored type has no option', async () => {
    // e.g. a type added to CONSOLE_TYPES but not to CONSOLE_TYPE_OPTIONS.
    window.localStorage.setItem('wiretap.consoleType.inst-1', 'NOVNC')

    const wrapper = await mountConsole()

    expect(typeButton(wrapper).text()).toContain('noVNC')
  })
})
