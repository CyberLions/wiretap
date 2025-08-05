// src/composables/useAuth.js
import { ref, computed } from 'vue'
import api from '@/services/api'

// Global state - this ensures all components use the same auth state
const globalUser = ref(null)
const globalIsAuthenticated = ref(false)

// Initialize auth state from localStorage
const initializeAuth = () => {
  const token = localStorage.getItem('wiretap_token')
  if (token && !globalUser.value) {
    api.setToken(token)
    // We'll fetch the user data when needed
  }
}

// Initialize on module load
initializeAuth()

export function useAuth() {
  const login = async (credentials) => {
    try {
      const response = await api.auth.login(credentials)
      const { token, user } = response.data
      
      // Set token in API service
      api.setToken(token)
      
      // Update global state
      globalUser.value = user
      globalIsAuthenticated.value = true
      
      return { success: true, user }
    } catch (error) {
      console.error('Login failed:', error)
      return { success: false, error: error.response?.data?.error || 'Login failed' }
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint
      await api.auth.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      // Clear token and state regardless of API call success
      api.clearToken()
      globalUser.value = null
      globalIsAuthenticated.value = false
    }
  }

  const getCurrentUser = async () => {
    try {
      const response = await api.auth.getCurrentUser()
      globalUser.value = response.data
      globalIsAuthenticated.value = true
      return response.data
    } catch (error) {
      console.error('Failed to get current user:', error)
      // If we can't get the user, they're not authenticated
      globalUser.value = null
      globalIsAuthenticated.value = false
      throw error
    }
  }

  const isAdmin = computed(() => {
    return globalUser.value?.role === 'ADMIN' || globalUser.value?.role === 'admin'
  })

  const isUser = computed(() => {
    return globalUser.value?.role === 'USER' || globalUser.value?.role === 'user'
  })

  return {
    user: globalUser,
    isAuthenticated: globalIsAuthenticated,
    isAdmin,
    isUser,
    login,
    logout,
    getCurrentUser
  }
}
