<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Edit User</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Username *
          </label>
          <input
            v-model="form.username"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter username"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            v-model="form.email"
            type="email"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              First Name
            </label>
            <input
              v-model="form.first_name"
              type="text"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="First name"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Last Name
            </label>
            <input
              v-model="form.last_name"
              type="text"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Last name"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Role
          </label>
          <select
            v-model="form.role"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <div class="flex items-center">
          <input
            v-model="form.enabled"
            type="checkbox"
            id="enabled"
            class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label for="enabled" class="ml-2 text-sm text-gray-300">
            User is enabled
          </label>
        </div>

        <!-- Password Change Section -->
        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-sm font-medium text-gray-300 mb-3">Change Password</h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <div class="relative">
                <input
                  v-model="form.newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  class="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  @click="showNewPassword = !showNewPassword"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                >
                  <EyeSlashIcon v-if="showNewPassword" class="w-4 h-4" />
                  <EyeIcon v-else class="w-4 h-4" />
                </button>
              </div>
              <p v-if="form.newPassword" class="text-xs mt-1" :class="passwordStrength.color">
                {{ passwordStrength.text }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <div class="relative">
                <input
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  @click="showConfirmPassword = !showConfirmPassword"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                >
                  <EyeSlashIcon v-if="showConfirmPassword" class="w-4 h-4" />
                  <EyeIcon v-else class="w-4 h-4" />
                </button>
              </div>
              <p v-if="form.confirmPassword" class="text-xs mt-1" :class="passwordMatch.color">
                {{ passwordMatch.text }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <span v-if="loading" class="flex items-center">
              <ArrowPathIcon class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
              Updating...
            </span>
            <span v-else>Update User</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import api from '@/services/api'
import { EyeIcon, EyeSlashIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'EditUserModal',
  components: {
    EyeIcon,
    EyeSlashIcon,
    ArrowPathIcon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    user: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const form = ref({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: 'USER',
      enabled: true,
      newPassword: '',
      confirmPassword: ''
    })

    const showNewPassword = ref(false)
    const showConfirmPassword = ref(false)

    // Computed property for password strength
    const passwordStrength = computed(() => {
      const password = form.value.newPassword
      if (!password) return { text: '', color: 'text-gray-400' }
      
      if (password.length < 6) return { text: 'Too short', color: 'text-red-400' }
      if (password.length < 8) return { text: 'Weak', color: 'text-orange-400' }
      if (password.length < 12) return { text: 'Good', color: 'text-yellow-400' }
      return { text: 'Strong', color: 'text-green-400' }
    })

    // Computed property for password match
    const passwordMatch = computed(() => {
      if (!form.value.newPassword || !form.value.confirmPassword) return { text: '', color: 'text-gray-400' }
      if (form.value.newPassword === form.value.confirmPassword) {
        return { text: 'Passwords match', color: 'text-green-400' }
      }
      return { text: 'Passwords do not match', color: 'text-red-400' }
    })

    const resetForm = () => {
      form.value = {
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'USER',
        enabled: true,
        newPassword: '',
        confirmPassword: ''
      }
      showNewPassword.value = false
      showConfirmPassword.value = false
    }

    const populateForm = (user) => {
      if (user) {
        console.log('Populating form with user data:', user)
        console.log('User enabled value:', user.enabled, 'Type:', typeof user.enabled)
        
        // Ensure enabled is a boolean value
        const enabledValue = user.enabled === true || user.enabled === 1 || user.enabled === '1' || user.enabled === 'true'
        
        form.value = {
          username: user.username || '',
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          role: user.role || 'USER',
          enabled: enabledValue,
          newPassword: '', // Clear new password fields on edit
          confirmPassword: ''
        }
        
        console.log('Form populated with enabled value:', form.value.enabled)
      }
    }

    const handleSubmit = async () => {
      if (!form.value.username) {
        emit('error', 'Username is required')
        return
      }

      // Validate password change if provided
      if (form.value.newPassword || form.value.confirmPassword) {
        if (!form.value.newPassword) {
          emit('error', 'New password is required when confirming password')
          return
        }
        if (!form.value.confirmPassword) {
          emit('error', 'Please confirm the new password')
          return
        }
        if (form.value.newPassword !== form.value.confirmPassword) {
          emit('error', 'Passwords do not match')
          return
        }
        if (form.value.newPassword.length < 6) {
          emit('error', 'Password must be at least 6 characters long')
          return
        }
      }

      loading.value = true
      try {
        // Update user data (excluding password fields)
        const userData = {
          username: form.value.username,
          email: form.value.email,
          first_name: form.value.first_name,
          last_name: form.value.last_name,
          role: form.value.role,
          enabled: form.value.enabled
        }
        
        const response = await api.users.update(props.user.id, userData)
        
        // Change password if provided
        if (form.value.newPassword) {
          await api.users.changePassword(props.user.id, form.value.newPassword)
        }
        
        emit('updated', response.data)
      } catch (error) {
        console.error('Error updating user:', error)
        const errorMessage = error.response?.data?.error || 'Failed to update user'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Populate form when user prop changes
    watch(() => props.user, (newUser) => {
      if (newUser) {
        populateForm(newUser)
      }
    }, { immediate: true })

    // Reset form when modal is closed
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        resetForm()
      }
    })

    return {
      loading,
      form,
      handleSubmit,
      passwordStrength,
      passwordMatch,
      showNewPassword,
      showConfirmPassword
    }
  }
}
</script> 