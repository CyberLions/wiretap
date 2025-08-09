import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

function resolveApiBaseUrl() {
  const fromWindow = typeof window !== 'undefined' && window.ENV ? (window.ENV.VITE_API_URL || window.ENV.VITE_BACKEND_URL) : undefined
  const fromImportMeta = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL) : undefined
  return fromWindow || fromImportMeta || 'http://localhost:3000/api'
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()
  
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('wiretap_token') || null)
  const loading = ref(false)
  
  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  
  // Actions
  const login = async (credentials) => {
    try {
      loading.value = true
      
      const response = await api.post('/auth/login', credentials)
      
      token.value = response.data.token
      user.value = response.data.user
      
      // Store token in localStorage
      localStorage.setItem('wiretap_token', token.value)
      
      // Set API token
      api.setToken(token.value)
      
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      }
    } finally {
      loading.value = false
    }
  }
  
  const loginWithOpenID = () => {
    const backendBase = resolveApiBaseUrl()
    window.location.href = `${backendBase}/auth/openid/login`
  }
  
  const handleAuthCallback = async (tokenFromUrl) => {
    try {
      loading.value = true
      
      token.value = tokenFromUrl
      user.value = null
      
      // Store token
      localStorage.setItem('wiretap_token', token.value)
      
      // Set API token
      api.setToken(token.value)
      
      // Verify token and get user info
      const response = await api.get('/auth/verify')
      
      if (response.data.valid) {
        user.value = response.data.user
        return { success: true }
      } else {
        throw new Error('Invalid token')
      }
    } catch (error) {
      console.error('Auth callback error:', error)
      logout()
      return { 
        success: false, 
        error: 'Authentication failed' 
      }
    } finally {
      loading.value = false
    }
  }
  
  const restoreSession = async () => {
    if (!token.value) {
      return false
    }
    
    try {
      loading.value = true
      
      // Set API token
      api.setToken(token.value)
      
      // Verify token
      const response = await api.get('/auth/verify')
      
      if (response.data.valid) {
        user.value = response.data.user
        return true
      } else {
        throw new Error('Invalid token')
      }
    } catch (error) {
      console.error('Session restoration error:', error)
      logout()
      return false
    } finally {
      loading.value = false
    }
  }
  
  const logout = () => {
    // Clear state
    user.value = null
    token.value = null
    
    // Clear localStorage
    localStorage.removeItem('wiretap_token')
    
    // Clear API token
    api.clearToken()
    
    // Redirect to login
    router.push('/login')
  }
  
  const updateUser = (userData) => {
    user.value = { ...user.value, ...userData }
  }
  
  return {
    // State
    user,
    token,
    loading,
    
    // Computed
    isAuthenticated,
    isAdmin,
    
    // Actions
    login,
    loginWithOpenID,
    handleAuthCallback,
    restoreSession,
    logout,
    updateUser
  }
}) 