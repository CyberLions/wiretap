<template>
  <div class="w-full h-full bg-black flex flex-col">
    <!-- Connection status: the serial socket can drop for reasons the user
         needs to know about (token expiry, someone else holding the port). -->
    <div
      v-if="status !== 'open'"
      class="px-4 py-2 text-xs font-mono border-b border-gray-700 flex items-center justify-between"
      :class="statusClass"
    >
      <span>{{ statusMessage }}</span>
      <button
        v-if="status === 'closed' || status === 'error'"
        @click="$emit('reconnect')"
        data-serial-reconnect
        class="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
      >
        Reconnect
      </button>
    </div>

    <!-- A serial getty prints its banner once, at boot. Attaching later lands
         on a tty that has nothing left to say, so the pane looks broken until
         the user pokes it. Say so rather than let them guess. -->
    <div
      v-if="status === 'open' && !hasOutput"
      class="px-4 py-2 text-xs font-mono border-b border-gray-700 bg-gray-800 text-gray-400"
    >
      Connected. Press Enter if the screen is blank.
    </div>

    <div ref="terminalEl" class="flex-1 min-h-0 w-full"></div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

export default {
  name: 'SerialConsole',
  props: {
    // wss:// URL from Nova's serial remote-console.
    url: {
      type: String,
      required: true
    },
    fontSize: {
      type: Number,
      default: 14
    }
  },
  emits: ['status', 'reconnect'],
  setup(props, { emit, expose }) {
    const terminalEl = ref(null)
    const status = ref('connecting')
    // Whether the far end has sent a single byte on this connection.
    const hasOutput = ref(false)

    let term = null
    let fitAddon = null
    let socket = null
    let resizeObserver = null

    const encoder = new TextEncoder()

    const statusMessage = computed(() => {
      switch (status.value) {
        case 'connecting':
          return 'Connecting to serial console...'
        case 'closed':
          return 'Serial console disconnected. The session token may have expired.'
        case 'error':
          return 'Serial console connection failed. Another session may already hold this port.'
        default:
          return ''
      }
    })

    const statusClass = computed(() =>
      status.value === 'error'
        ? 'bg-red-900/60 text-red-200'
        : 'bg-gray-800 text-gray-300'
    )

    const setStatus = (next) => {
      status.value = next
      emit('status', next)
    }

    const fit = () => {
      if (!fitAddon) return
      try {
        fitAddon.fit()
      } catch (err) {
        // fit() throws if the element has no layout yet (hidden tab, etc).
      }
    }

    const disconnect = () => {
      if (!socket) return
      // Drop the handlers first so closing does not flip status to 'closed'
      // when we are the ones tearing it down.
      socket.onopen = null
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null
      if (socket.readyState === 0 || socket.readyState === 1) {
        socket.close()
      }
      socket = null
    }

    const connect = () => {
      if (!props.url) return

      disconnect()
      hasOutput.value = false
      setStatus('connecting')

      // Nova's serial proxy is websockify underneath, which negotiates the
      // 'binary' subprotocol for raw byte frames.
      socket = new WebSocket(props.url, ['binary'])
      socket.binaryType = 'arraybuffer'

      socket.onopen = () => {
        setStatus('open')
        fit()
        // Nothing is sent on connect. A serial console attaches to a tty that
        // is already running and may be shared, so even a bare carriage return
        // would answer whatever prompt is sitting there.
      }

      socket.onmessage = (event) => {
        if (!term || event.data == null) return
        hasOutput.value = true

        if (typeof event.data === 'string') {
          term.write(event.data)
        } else if (typeof event.data.arrayBuffer === 'function') {
          // Blob, if the socket ever hands one back.
          event.data.arrayBuffer().then((buffer) => {
            if (term) term.write(new Uint8Array(buffer))
          })
        } else {
          // ArrayBuffer or a typed-array view of one. Deliberately not an
          // `instanceof ArrayBuffer` check: frames can arrive carrying a
          // different realm's constructor.
          //
          // The bytes go to xterm undecoded on purpose: the proxy splits the
          // stream at arbitrary boundaries, and xterm's decoder carries state
          // across writes, so a multi-byte character straddling two frames
          // still lands intact.
          term.write(
            ArrayBuffer.isView(event.data)
              ? new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
              : new Uint8Array(event.data)
          )
        }
      }

      socket.onerror = () => setStatus('error')
      socket.onclose = () => {
        if (status.value !== 'error') setStatus('closed')
      }
    }

    const send = (data) => {
      if (!socket || socket.readyState !== 1) return
      socket.send(encoder.encode(data))
    }

    onMounted(() => {
      // Deliberately not awaiting anything here: the template ref is already
      // populated when onMounted fires, and an await would let the component
      // unmount mid-setup, leaving a terminal and listeners behind.
      if (!terminalEl.value) return

      term = new Terminal({
        fontSize: props.fontSize,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
        cursorBlink: true,
        convertEol: false,
        // Keeps a usable amount of history for someone joining a long session.
        scrollback: 5000,
        theme: { background: '#000000', foreground: '#e5e7eb' }
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalEl.value)
      fit()

      // Everything typed (and everything pasted, which xterm delivers through
      // the same path) goes straight down the socket.
      term.onData(send)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(fit)
        resizeObserver.observe(terminalEl.value)
      }
      window.addEventListener('resize', fit)

      connect()
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', fit)
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
      disconnect()
      if (term) {
        term.dispose()
        term = null
      }
    })

    // Refreshing the console hands us a new token, and therefore a new URL.
    watch(() => props.url, (next, previous) => {
      if (next && next !== previous) connect()
    })

    expose({ connect, disconnect, fit })

    return {
      terminalEl,
      status,
      hasOutput,
      statusMessage,
      statusClass,
      connect
    }
  }
}
</script>
