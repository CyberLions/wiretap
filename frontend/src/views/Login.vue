<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="mx-auto h-32 w-32 flex items-center justify-center rounded-full overflow-hidden">
          <img 
            src="@/assets/icons/icon.png" 
            alt="Wiretap Logo" 
            class="h-24 w-24 object-contain"
          />
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
          Wiretap
        </h2>
        <p class="mt-2 text-center text-sm text-gray-400">
          CCSO Competition Platform
        </p>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-medium text-white">Sign in to your account</h3>
        </div>
        
        <div class="card-body">
          <!-- Login Form -->
          <form v-if="!showOpenID" @submit.prevent="handleLogin" class="space-y-6">
            <div>
              <label for="username" class="form-label">Username</label>
              <input
                id="username"
                v-model="form.username"
                type="text"
                required
                class="form-input"
                placeholder="Enter your username"
              />
            </div>
            
            <div>
              <label for="password" class="form-label">Password</label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                required
                class="form-input"
                placeholder="Enter your password"
              />
            </div>
            
            <div v-if="error" class="form-error">
              {{ error }}
            </div>
            
            <div>
              <button
                type="submit"
                :disabled="authStore.loading"
                class="btn btn-primary w-full"
              >
                <span v-if="authStore.loading" class="spinner w-4 h-4 mr-2"></span>
                {{ authStore.loading ? 'Signing in...' : 'Sign in' }}
              </button>
            </div>
          </form>
          
          <!-- OpenID Connect Button -->
          <div v-if="!showOpenID" class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-600"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-gray-800 text-gray-400">Or continue with</span>
              </div>
            </div>
            
            <div class="mt-6">
              <button
                @click="handleOpenIDLogin"
                class="btn btn-secondary w-full flex items-center justify-center"
              >
                <ArrowRightOnRectangleIcon class="w-5 h-5 mr-2 flex-shrink-0" />
                Sign in with SSO
              </button>
            </div>
          </div>
          
          <!-- OpenID Connect Info -->
          <div v-if="showOpenID" class="text-center">
            <div class="spinner w-8 h-8 mx-auto mb-4"></div>
            <p class="text-gray-300">Redirecting to SSO provider...</p>
            <p class="text-gray-400 text-sm mt-2">You will be redirected back to Wiretap after authentication.</p>
          </div>
        </div>
      </div>
      
      <div class="text-center">
        <p class="text-gray-400 text-sm">
          Need help? Contact your our tech team
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'Login',
  components: {
    ArrowRightOnRectangleIcon
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    
    const showOpenID = ref(false)
    const error = ref('')
    
    const form = reactive({
      username: '',
      password: ''
    })
    
    const handleLogin = async () => {
      error.value = ''
      
      const result = await authStore.login({
        username: form.username,
        password: form.password
      })
      
      if (result.success) {
        router.push('/dashboard')
      } else {
        error.value = result.error
      }
    }
    
    const handleOpenIDLogin = () => {
      showOpenID.value = true
      authStore.loginWithOpenID()
    }
    
    return {
      authStore,
      form,
      error,
      showOpenID,
      handleLogin,
      handleOpenIDLogin
    }
  }
}
</script> 