<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Instance Info Bar -->
    <div v-if="!isFullscreen" class="bg-gray-800 border-b border-gray-700 px-6 py-4">
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
              {{ parseIpAddresses(instance?.ip_addresses).join(', ') || 'No IP addresses' }}
            </div>
          </div>

          <!-- Console Controls -->
          <div class="flex items-center space-x-2">
            <!-- Fullscreen Button -->
            <button
              @click="toggleFullscreen"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {{ isFullscreen ? 'Exit' : 'Fullscreen' }}
            </button>

            <!-- Refresh Console Button -->
            <button
              @click="refreshConsole"
              :disabled="isRefreshing || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ isRefreshing ? 'Refreshing...' : 'Refresh Console' }}
            </button>

            <!-- Shutdown Button -->
            <button
              @click="shutdownInstance"
              :disabled="isPowering || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Shutdown
            </button>

            <!-- Power On Button -->
            <button
              @click="powerOnInstance"
              :disabled="isPowering || isLocked"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Power On
            </button>

            <!-- Reboot Dropdown -->
            <div class="relative">
              <button
                @click="toggleRebootMenu"
                :disabled="isPowering || isLocked"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ selectedRebootType }}
                <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Reboot Menu -->
              <div
                v-if="isRebootMenuOpen"
                class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50"
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
    <div class="flex-1 relative" style="height: calc(100vh - 80px);">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-96">
        <div class="text-center">
          <div class="spinner w-8 h-8 mx-auto mb-4"></div>
          <p class="text-gray-400">Loading console...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center h-96">
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
      <div v-else-if="isLocked" class="flex items-center justify-center h-96">
        <div class="text-center">
          <svg class="w-16 h-16 text-yellow-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
          </svg>
          <h3 class="text-xl font-semibold text-white mb-2">VM is Locked</h3>
          <p class="text-gray-400">This virtual machine is currently locked and cannot be accessed.</p>
        </div>
      </div>

      <!-- Console Not Available State -->
      <div v-else-if="!canShowConsole" class="flex items-center justify-center h-96">
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Console Not Available</h3>
          <p class="text-gray-400">{{ getStatusMessage() }}</p>
        </div>
      </div>

      <!-- Console Display -->
      <div v-else class="h-full">
        <div
          ref="consoleContainer"
          class="w-full h-full bg-black"
          :class="{ 'fixed inset-0 z-50': isFullscreen }"
          style="min-height: 600px;"
        >
          <!-- Fullscreen Controls Overlay -->
          <div v-if="isFullscreen" class="absolute top-0 left-0 right-0 bg-gray-800 bg-opacity-90 p-4 z-10">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
                <span class="text-white font-semibold">{{ instance?.name || 'Console' }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  @click="toggleBrowserFullscreen"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {{ isBrowserFullscreen ? 'Exit Browser Fullscreen' : 'Browser Fullscreen' }}
                </button>
                <button
                  @click="toggleFullscreen"
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Exit Fullscreen
                </button>
              </div>
            </div>
          </div>
          <!-- VNC Console iframe -->
          <iframe
            v-if="consoleUrl"
            :src="consoleUrl"
            class="w-full h-full border-0"
            allowfullscreen
          ></iframe>
          <div v-else class="w-full h-full flex items-center justify-center text-green-400 font-mono text-sm">
            <div class="text-center">
              <!-- Cool connecting animation -->
              <div class="mb-6">
                <div class="flex items-center justify-center space-x-2 mb-4">
                  <div class="w-3 h-3 bg-green-500 rounded-full animate-bounce"></div>
                  <div class="w-3 h-3 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                  <div class="w-3 h-3 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
                <div class="text-green-500 font-bold text-lg mb-2">Connecting to Console</div>
                <div class="flex items-center justify-center space-x-1">
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                </div>
              </div>
              <div class="text-gray-400 text-sm">
                <p>Establishing secure connection...</p>
                <p class="mt-1">Please wait while we connect to your virtual machine</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Overlay -->
    <div
      v-if="isFullscreen"
      class="fixed inset-0 bg-black bg-opacity-75 z-40"
      @click="toggleFullscreen"
    ></div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'

export default {
  name: 'Console',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const { user } = useAuth()
    
    const loading = ref(false)
    const error = ref(null)
    const instance = ref(null)
    const isFullscreen = ref(false)
    const isBrowserFullscreen = ref(false)
    const isRefreshing = ref(false)
    const isPowering = ref(false)
    const isRebootMenuOpen = ref(false)
    const selectedRebootType = ref('Soft Reboot')
    const consoleContainer = ref(null)
    const consoleUrl = ref('')

    const isLocked = computed(() => {
      if (user.value?.role === 'ADMIN' || user.value?.role === 'admin') return false
      return instance.value?.locked || false
    })

    const canShowConsole = computed(() => {
      if (isLocked.value) return false
      if (!instance.value) return false
      return ['running', 'powered_on', 'active'].includes(instance.value.status?.toLowerCase())
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

    const toggleFullscreen = () => {
      isFullscreen.value = !isFullscreen.value
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
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error shutting down instance:', err)
      } finally {
        isPowering.value = false
      }
    }

    const powerOnInstance = async () => {
      isPowering.value = true
      try {
        await api.instances.powerOn(instance.value.id)
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error powering on instance:', err)
      } finally {
        isPowering.value = false
      }
    }

    const toggleRebootMenu = () => {
      isRebootMenuOpen.value = !isRebootMenuOpen.value
    }

    const rebootInstance = async (type) => {
      isPowering.value = true
      isRebootMenuOpen.value = false
      selectedRebootType.value = type === 'soft' ? 'Soft Reboot' : 'Hard Reboot'
      
      try {
        await api.instances.reboot(instance.value.id, type)
        await loadInstance() // Refresh instance status
      } catch (err) {
        console.error('Error rebooting instance:', err)
      } finally {
        isPowering.value = false
      }
    }

    // Close reboot menu when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.reboot-menu')) {
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
      isFullscreen,
      isRefreshing,
      isPowering,
      isRebootMenuOpen,
      selectedRebootType,
      consoleContainer,
      consoleUrl,
      isLocked,
      canShowConsole,
      getStatusColor,
      getStatusMessage,
      parseIpAddresses,
      loadInstance,
      toggleFullscreen,
      toggleBrowserFullscreen,
      refreshConsole,
      shutdownInstance,
      powerOnInstance,
      toggleRebootMenu,
      rebootInstance
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style>