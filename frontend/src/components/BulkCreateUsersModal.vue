<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Bulk Create Users</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Number of Users *
          </label>
          <input
            v-model.number="form.count"
            type="number"
            min="1"
            max="100"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter number of users to create"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Username Prefix *
          </label>
          <input
            v-model="form.prefix"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., user, student, participant"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Default Password *
          </label>
          <input
            v-model="form.password"
            type="password"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter default password"
          />
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
            Users are enabled by default
          </label>
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
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </span>
            <span v-else>Create Users</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import api from '@/services/api'

export default {
  name: 'BulkCreateUsersModal',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'created', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const form = ref({
      count: 10,
      prefix: 'user',
      password: 'password123',
      role: 'USER',
      enabled: true
    })

    const resetForm = () => {
      form.value = {
        count: 10,
        prefix: 'user',
        password: 'password123',
        role: 'USER',
        enabled: true
      }
    }

    const handleSubmit = async () => {
      loading.value = true
      try {
        await api.users.generateUsers(form.value)
        emit('created')
        emit('close')
        resetForm()
      } catch (error) {
        console.error('Error creating users:', error)
        const errorMessage = error.response?.data?.error || 'Failed to create users'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Reset form when modal closes
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        resetForm()
      }
    })

    return {
      loading,
      form,
      handleSubmit
    }
  }
}
</script> 