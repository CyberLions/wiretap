<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900">
    <div class="text-center">
      <div class="spinner w-12 h-12 mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold text-white mb-2">Processing authentication...</h2>
      <p class="text-gray-400">Please wait while we complete your login.</p>
    </div>
  </div>
</template>

<script>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'

export default {
  name: 'Loading',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const { getCurrentUser } = useAuth()
    
    onMounted(async () => {
      // Get token from URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token')
      
      if (token) {
        try {
          // Set token in API service
          api.setToken(token)
          
          // Store token in localStorage
          localStorage.setItem('wiretap_token', token)
          
          // Get current user to verify token and update auth state
          await getCurrentUser()
          
          // Redirect to dashboard
          router.push('/dashboard')
        } catch (error) {
          console.error('Auth callback error:', error)
          // Clear token and redirect to login
          api.clearToken()
          localStorage.removeItem('wiretap_token')
          router.push('/login')
        }
      } else {
        // No token found, redirect to login
        router.push('/login')
      }
    })
  }
}
</script> 