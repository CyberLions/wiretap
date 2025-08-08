<template>
  <div :class="isFullscreenRoute ? 'h-screen' : 'h-[93vh]'" class="bg-gray-900 flex flex-col overflow-hidden">
    <!-- Instance Info Bar -->
    <div v-if="!isFullscreen || isFullscreenRoute" class="bg-gray-800 border-b border-gray-700 px-6 py-4 flex-shrink-0">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between">
          <!-- Instance Info -->
          <div class="flex items-center space-x-6">
            <div class="flex items-center space-x-3">
              <!-- Status Indicator -->
              <div
                class="w-3 h-3 rounded-full"
                :class="getStatusColor(instance?.status)"
              ></div>
              <h1 class="text-xl font-semibold text-white">
                {{ instance?.name || 'Loading...' }}
              </h1>
            </div>
            
            <!-- IP Addresses -->
            <div class="text-gray-400">
              {{ parseIpAddresses(instance?.ip_addresses).join(', ') || 'IP addresses not available' }}
            </div>
          </div>

          <!-- Console Controls -->
          <div class="flex items-center space-x-2">
            <!-- Back Button (Fullscreen Route) -->
            <button
              v-if="isFullscreenRoute"
              @click="goBackToConsole"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <ArrowLeftIcon class="w-4 h-4 mr-2" />
              Back
            </button>

            <!-- Browser Fullscreen Button (Fullscreen Route) -->
            <button
              v-if="isFullscreenRoute"
              @click="toggleBrowserFullscreen"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <ArrowsPointingOutIcon class="w-4 h-4 mr-2" />
              {{ isBrowserFullscreen ? 'Exit Browser Fullscreen' : 'Browser Fullscreen' }}
            </button>

            <!-- Fullscreen Route Button (Regular Console) -->
            <button
              v-if="!isFullscreenRoute"
              @click="goToFullscreenRoute"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <ArrowsPointingOutIcon class="w-4 h-4 mr-2" />
              Fullscreen
            </button>

            <!-- Refresh Console Button -->
            <button
              @click="refreshConsole"
              :disabled="isRefreshing || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <ArrowPathIcon class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Refreshing...' : 'Refresh Console' }}
            </button>

            <!-- Shutdown Button -->
            <button
              @click="shutdownInstance"
              :disabled="isPowering || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <PowerIcon class="w-4 h-4 mr-2" />
              Shutdown
            </button>

            <!-- Power On Button -->
            <button
              @click="powerOnInstance"
              :disabled="isPowering || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <BoltIcon class="w-4 h-4 mr-2" />
              Power On
            </button>

            <!-- Reboot Dropdown -->
            <div class="relative">
              <button
                @click="toggleRebootMenu"
                :disabled="isPowering || isLocked"
                data-reboot-button
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
              >
                <ArrowPathIcon v-if="isPowering" class="w-4 h-4 mr-2 animate-spin" />
                <ArrowPathIcon v-else class="w-4 h-4 mr-2" />
                {{ isPowering ? 'Rebooting...' : 'Reboot' }}
                <ChevronDownIcon v-if="!isPowering" class="w-4 h-4 ml-2" />
              </button>

              <!-- Reboot Menu -->
              <div
                v-if="isRebootMenuOpen"
                class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 reboot-menu"
              >
                <div class="py-1">
                  <button
                    @click="rebootInstance('soft')"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
                  >
                    Soft Reboot
                  </button>
                  <button
                    @click="rebootInstance('hard')"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
                  >
                    Hard Reboot
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Console Area -->
    <div class="flex-1 relative overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="spinner w-8 h-8 mx-auto mb-4"></div>
          <p class="text-gray-400">Loading console...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="text-red-400 text-lg mb-4">{{ error }}</div>
          <button
            @click="loadInstance"
            class="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Locked State -->
      <div v-else-if="isLocked" class="flex items-center justify-center h-full">
        <div class="text-center">
          <LockClosedIcon class="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">VM is Locked</h3>
          <p class="text-gray-400">This virtual machine is currently locked and cannot be accessed.</p>
        </div>
      </div>

      <!-- Console Not Available State -->
      <div v-else-if="!canShowConsole" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ComputerDesktopIcon class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Console Not Available</h3>
          <p class="text-gray-400">{{ getStatusMessage() }}</p>
        </div>
      </div>

      <!-- Console Display -->
      <div v-else class="h-full w-full console-container">
        <div
          ref="consoleContainer"
          class="w-full h-full bg-black"
        >
          <!-- VNC Console iframe -->
          <iframe
            v-if="consoleUrl"
            :src="consoleUrl"
            class="w-full h-full border-0"
            allowfullscreen
            frameborder="0"
            scrolling="no"
          ></iframe>
          <div v-else class="w-full h-full flex items-center justify-center text-green-400 font-mono text-sm">
            <div class="text-center">
              <!-- Cool terminal hacking animation -->
              <div class="mb-8">
                <!-- Terminal screen with matrix-style effect -->
                <div class="terminal-screen bg-black border-2 border-green-500 rounded-lg p-6 mb-6 relative overflow-hidden">
                  <div class="terminal-content">
                    <!-- Matrix rain effect -->
                    <div class="matrix-rain">
                      <div v-for="i in 20" :key="i" class="matrix-column" :style="{ left: (i * 5) + '%', animationDelay: (i * 0.1) + 's' }">
                        <div v-for="j in 15" :key="j" class="matrix-char" :style="{ animationDelay: (j * 0.1) + 's' }">
                          {{ getRandomChar() }}
                        </div>
                      </div>
                    </div>
                    
                    <!-- Connection status lines -->
                    <div class="connection-lines">
                      <div class="connection-line" style="animation-delay: 0.5s">
                        <span class="text-green-500">$</span> <span class="text-white">connecting_to_vm</span>
                      </div>
                      <div class="connection-line" style="animation-delay: 1s">
                        <span class="text-green-500">$</span> <span class="text-white">establishing_secure_tunnel</span>
                      </div>
                      <div class="connection-line" style="animation-delay: 1.5s">
                        <span class="text-green-500">$</span> <span class="text-white">authenticating_credentials</span>
                      </div>
                      <div class="connection-line" style="animation-delay: 2s">
                        <span class="text-green-500">$</span> <span class="text-white">initializing_console_session</span>
                      </div>
                      <div class="connection-line" style="animation-delay: 2.5s">
                        <span class="text-green-500">$</span> <span class="text-white">loading_virtual_machine</span>
                      </div>
                    </div>
                    
                    <!-- Cursor blink -->
                    <div class="cursor-blink">█</div>
                  </div>
                </div>
                
                <!-- Rocket animation -->
                <div class="rocket-container">
                  <div class="rocket">
                    <div class="rocket-body">
                      <div class="rocket-nose"></div>
                      <div class="rocket-window"></div>
                      <div class="rocket-fins">
                        <div class="fin fin-left"></div>
                        <div class="fin fin-right"></div>
                      </div>
                    </div>
                    <div class="rocket-exhaust">
                      <div class="exhaust-flame"></div>
                      <div class="exhaust-flame"></div>
                      <div class="exhaust-flame"></div>
                    </div>
                  </div>
                  <div class="launch-pad"></div>
                </div>
              </div>
              
              <div class="text-gray-400 text-sm">
                <p class="text-green-500 font-bold text-lg mb-2">Connecting to Console</p>
                <p>Establishing secure connection...</p>
                <p class="mt-1">Please wait while we connect to your virtual machine</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <Toast
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @close="closeToast"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'
import Toast from '@/components/Toast.vue'
import { 
  ArrowLeftIcon, 
  ArrowsPointingOutIcon, 
  ArrowPathIcon, 
  LockClosedIcon, 
  ComputerDesktopIcon,
  ChevronDownIcon,
  PowerIcon,
  BoltIcon
} from '@heroicons/vue/24/outline'

export default {
  name: 'Console',
  components: {
    Toast,
    ArrowLeftIcon,
    ArrowsPointingOutIcon,
    ArrowPathIcon,
    LockClosedIcon,
    ComputerDesktopIcon,
    ChevronDownIcon,
    PowerIcon,
    BoltIcon
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const { user } = useAuth()
    
    const loading = ref(false)
    const error = ref(null)
    const instance = ref(null)
    const isBrowserFullscreen = ref(false)
    const isRefreshing = ref(false)
    const isPowering = ref(false)
    const isRebootMenuOpen = ref(false)
    const consoleContainer = ref(null)
    const consoleUrl = ref('')

    // Toast notifications
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    })

    const isLocked = computed(() => {
      if (user.value?.role === 'ADMIN' || user.value?.role === 'admin') return false
      return instance.value?.locked || false
    })

    const canShowConsole = computed(() => {
      if (isLocked.value) return false
      if (!instance.value) return false
      return ['running', 'powered_on', 'active'].includes(instance.value.status?.toLowerCase())
    })

    const isFullscreenRoute = computed(() => {
      return route.meta?.hideHeader || false
    })

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'running':
        case 'powered_on':
        case 'active':
          return 'bg-green-500'
        case 'stopped':
        case 'powered_off':
        case 'shutoff':
          return 'bg-red-500'
        case 'starting':
        case 'stopping':
        case 'rebooting':
        case 'building':
          return 'bg-yellow-500'
        default:
          return 'bg-gray-500'
      }
    }

    const getStatusMessage = () => {
      if (!instance.value) return 'Loading instance information...'
      
      switch (instance.value.status?.toLowerCase()) {
        case 'stopped':
        case 'powered_off':
        case 'shutoff':
          return 'VM is powered off. Power on the VM to access the console.'
        case 'starting':
        case 'building':
          return 'VM is starting up. Please wait...'
        case 'stopping':
          return 'VM is shutting down. Please wait...'
        case 'rebooting':
          return 'VM is rebooting. Please wait...'
        default:
          return 'Console is not available for this VM state.'
      }
    }

    const parseIpAddresses = (ipAddresses) => {
      if (!ipAddresses) return []
      try {
        return JSON.parse(ipAddresses)
      } catch {
        return [ipAddresses]
      }
    }

    const getRandomChar = () => {
      const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
      return chars[Math.floor(Math.random() * chars.length)]
    }

    const loadInstance = async () => {
      loading.value = true
      error.value = null
      
      try {
        const response = await api.instances.getById(route.params.id)
        instance.value = response.data
      } catch (err) {
        console.error('Error loading instance:', err)
        error.value = 'Failed to load instance. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const loadConsole = async () => {
      if (!instance.value || isLocked.value) return
      
      try {
        const response = await api.instances.getConsole(instance.value.id, 'vnc')
        consoleUrl.value = response.data.console_url
      } catch (err) {
        console.error('Error loading console:', err)
        consoleUrl.value = ''
      }
    }



    const goToFullscreenRoute = () => {
      router.push(`/console/${route.params.id}/fullscreen`)
    }

    const goBackToConsole = async () => {
      // Exit browser fullscreen if active
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
          isBrowserFullscreen.value = false
        } catch (err) {
          console.error('Error exiting browser fullscreen:', err)
        }
      }
      
      router.push(`/console/${route.params.id}`)
    }

    const toggleBrowserFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
          isBrowserFullscreen.value = true
        } else {
          await document.exitFullscreen()
          isBrowserFullscreen.value = false
        }
      } catch (err) {
        console.error('Error toggling browser fullscreen:', err)
      }
    }

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      isBrowserFullscreen.value = !!document.fullscreenElement
    }

    const refreshConsole = async () => {
      isRefreshing.value = true
      try {
        await loadConsole()
      } catch (err) {
        console.error('Error refreshing console:', err)
      } finally {
        isRefreshing.value = false
      }
    }

    const shutdownInstance = async () => {
      isPowering.value = true
      try {
        await api.instances.powerOff(instance.value.id)
        showToast('Instance shutdown initiated successfully', 'success')
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error shutting down instance:', err)
        showToast(`Failed to shutdown instance: ${err.response?.data?.error || err.message}`, 'error')
      } finally {
        isPowering.value = false
      }
    }

    const powerOnInstance = async () => {
      isPowering.value = true
      try {
        await api.instances.powerOn(instance.value.id)
        showToast('Instance power on initiated successfully', 'success')
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error powering on instance:', err)
        showToast(`Failed to power on instance: ${err.response?.data?.error || err.message}`, 'error')
      } finally {
        isPowering.value = false
      }
    }

    const toggleRebootMenu = () => {
      isRebootMenuOpen.value = !isRebootMenuOpen.value
    }

    const showToast = (message, type = 'success') => {
      toast.value = {
        show: true,
        message,
        type
      }
      setTimeout(() => {
        toast.value.show = false
      }, 3000)
    }

    const closeToast = () => {
      toast.value.show = false
    }

    const rebootInstance = async (type) => {
      console.log(`Attempting ${type} reboot for instance:`, instance.value?.id)
      isPowering.value = true
      isRebootMenuOpen.value = false
      
      try {
        console.log('Calling API reboot endpoint...')
        const response = await api.instances.reboot(instance.value.id, type)
        console.log('Reboot API response:', response)
        // Show success message
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} reboot initiated successfully`, 'success')
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error rebooting instance:', err)
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        })
        // Show error message to user
        showToast(`Failed to ${type} reboot instance: ${err.response?.data?.error || err.message}`, 'error')
      } finally {
        isPowering.value = false
      }
    }

    // Close reboot menu when clicking outside
    const handleClickOutside = (event) => {
      const rebootMenu = document.querySelector('.reboot-menu')
      const rebootButton = event.target.closest('button[data-reboot-button]')
      
      if (rebootMenu && !rebootMenu.contains(event.target) && !rebootButton) {
        isRebootMenuOpen.value = false
      }
    }

    onMounted(async () => {
      await loadInstance()
      if (canShowConsole.value) {
        await loadConsole()
      }
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    })

    return {
      loading,
      error,
      instance,
      isBrowserFullscreen,
      isRefreshing,
      isPowering,
      isRebootMenuOpen,
      consoleContainer,
      consoleUrl,
      isLocked,
      canShowConsole,
      isFullscreenRoute,
      getStatusColor,
      getStatusMessage,
      parseIpAddresses,
      getRandomChar,
      loadInstance,
      goToFullscreenRoute,
      goBackToConsole,
      toggleBrowserFullscreen,
      refreshConsole,
      shutdownInstance,
      powerOnInstance,
      toggleRebootMenu,
      rebootInstance,
      toast,
      showToast,
      closeToast
    }
  }
}
</script>

<style scoped>
/* Ensure iframe fits perfectly without scrolling */
iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
}

/* Prevent any overflow */
.console-container {
  overflow: hidden;
}

/* Ensure the main container uses full viewport */
.min-h-screen {
  min-height: 100vh;
}

/* Terminal Screen Styles */
.terminal-screen {
  width: 400px;
  height: 250px;
  position: relative;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
}

.terminal-content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: 10px;
}

/* Matrix Rain Effect */
.matrix-rain {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.matrix-column {
  position: absolute;
  top: -100%;
  animation: matrix-fall 3s linear infinite;
}

.matrix-char {
  color: #00ff00;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 5px #00ff00;
  animation: matrix-glow 2s ease-in-out infinite;
}

@keyframes matrix-fall {
  0% {
    top: -100%;
  }
  100% {
    top: 100%;
  }
}

@keyframes matrix-glow {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

/* Connection Lines */
.connection-lines {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
}

.connection-line {
  opacity: 0;
  animation: typewriter 0.5s ease-in-out forwards;
}

@keyframes typewriter {
  0% {
    opacity: 0;
    transform: translateX(-10px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Cursor Blink */
.cursor-blink {
  color: #00ff00;
  animation: blink 1s infinite;
  font-family: 'Courier New', monospace;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* Rocket Animation */
.rocket-container {
  position: relative;
  height: 120px;
  margin: 20px 0;
}

.rocket {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  animation: rocket-launch 4s ease-in-out infinite;
}

.rocket-body {
  width: 40px;
  height: 80px;
  background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
  border-radius: 50% 50% 20% 20%;
  position: relative;
  box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
}

.rocket-nose {
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 20px solid transparent;
  border-right: 20px solid transparent;
  border-bottom: 25px solid #ff6b6b;
}

.rocket-window {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: #87ceeb;
  border-radius: 50%;
  border: 2px solid #fff;
}

.rocket-fins {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 20px;
}

.fin {
  position: absolute;
  width: 20px;
  height: 15px;
  background: #ff4757;
  border-radius: 0 0 10px 10px;
}

.fin-left {
  left: -25px;
  transform: rotate(-15deg);
}

.fin-right {
  right: -25px;
  transform: rotate(15deg);
}

.rocket-exhaust {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.exhaust-flame {
  width: 8px;
  height: 20px;
  background: linear-gradient(to top, #ffa500, #ff4500, #ff0000);
  border-radius: 0 0 4px 4px;
  animation: flame-flicker 0.1s ease-in-out infinite alternate;
}

@keyframes flame-flicker {
  0% {
    height: 18px;
    opacity: 0.8;
  }
  100% {
    height: 22px;
    opacity: 1;
  }
}

@keyframes rocket-launch {
  0% {
    bottom: 20px;
    transform: translateX(-50%) scale(1);
  }
  25% {
    bottom: 40px;
    transform: translateX(-50%) scale(1.1);
  }
  50% {
    bottom: 60px;
    transform: translateX(-50%) scale(1.2);
  }
  75% {
    bottom: 80px;
    transform: translateX(-50%) scale(1.1);
  }
  100% {
    bottom: 100px;
    transform: translateX(-50%) scale(1);
  }
}

.launch-pad {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 10px;
  background: linear-gradient(to top, #2c3e50, #34495e);
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

/* Smoke trail effect */
.rocket::after {
  content: '';
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 40px;
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  animation: smoke-rise 2s ease-out infinite;
}

@keyframes smoke-rise {
  0% {
    opacity: 0.8;
    transform: translateX(-50%) scale(0.5);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(2) translateY(-20px);
  }
}
</style>