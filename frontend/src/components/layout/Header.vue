<template>
  <header class="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo and Brand -->
        <div class="flex items-center">
          <router-link to="/" class="flex items-center group">
            <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
              <span class="text-white font-bold text-lg">C</span>
            </div>
            <div class="ml-3">
              <h1 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-200">
                CCSO
              </h1>
            </div>
          </router-link>
        </div>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center space-x-8">
          <router-link 
            v-for="item in navigationItems" 
            :key="item.name"
            :to="item.path"
            class="text-gray-300 hover:text-blue-400 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 relative group"
            :class="{ 'text-blue-400': $route.path === item.path }"
          >
            {{ item.name }}
            <span 
              v-if="$route.path === item.path"
              class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full"
            ></span>
          </router-link>
        </nav>

        <!-- User Menu -->
        <div class="flex items-center space-x-4">
          <!-- User Avatar and Menu -->
          <div class="relative">
            <button
              @click="isUserMenuOpen = !isUserMenuOpen"
              class="flex items-center space-x-2 text-gray-300 hover:text-blue-400 transition-colors duration-200"
            >
              <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ userInitials }}
                </span>
              </div>
              <span class="hidden sm:block text-sm font-medium">
                {{ userName }}
              </span>
            </button>

            <!-- User Dropdown Menu -->
            <div
              v-if="isUserMenuOpen"
              class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50"
            >
              <div class="py-1">
                <div class="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
                  Hello, {{ userName }}
                </div>
                <router-link
                  to="/account"
                  @click="isUserMenuOpen = false"
                  class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
                >
                  Account Settings
                </router-link>
                <button
                  @click="handleLogout"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <!-- Mobile menu button -->
          <div class="md:hidden">
            <button
              @click="isMobileMenuOpen = !isMobileMenuOpen"
              class="text-gray-300 hover:text-blue-400 p-2 rounded-md transition-colors duration-200"
            >
              <svg
                v-if="!isMobileMenuOpen"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                v-else
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div 
        v-show="isMobileMenuOpen"
        class="md:hidden border-t border-gray-700 bg-gray-900"
      >
        <div class="px-2 pt-2 pb-3 space-y-1">
          <router-link
            v-for="item in navigationItems"
            :key="item.name"
            :to="item.path"
            @click="isMobileMenuOpen = false"
            class="text-gray-300 hover:text-blue-400 hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
            :class="{ 'text-blue-400 bg-gray-800': $route.path === item.path }"
          >
            {{ item.name }}
          </router-link>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

export default {
  name: 'Header',
  setup() {
    const router = useRouter()
    const { user, logout } = useAuth()
    
    const isMobileMenuOpen = ref(false)
    const isUserMenuOpen = ref(false)
    
    const navigationItems = computed(() => {
      const items = [
        { name: 'Dashboard', path: '/dashboard' }
      ]
      
      // Add admin navigation if user is admin
      if (user.value?.role === 'ADMIN' || user.value?.role === 'admin') {
        items.push(
          { name: 'Admin', path: '/admin' },
          { name: 'Logs', path: '/logs' }
        )
      }
      
      return items
    })

    const userName = computed(() => {
      if (!user.value) return 'User'
      return `${user.value.first_name || ''} ${user.value.last_name || ''}`.trim() || user.value.username || 'User'
    })

    const userInitials = computed(() => {
      if (!user.value) return 'U'
      const firstName = user.value.first_name || ''
      const lastName = user.value.last_name || ''
      return `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}` || user.value.username?.charAt(0) || 'U'
    })

    const handleLogout = async () => {
      try {
        await logout()
        router.push('/login')
      } catch (error) {
        console.error('Logout failed:', error)
      }
    }

    // Close user menu when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-menu')) {
        isUserMenuOpen.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      isMobileMenuOpen,
      isUserMenuOpen,
      navigationItems,
      userName,
      userInitials,
      handleLogout
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style> 