<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Edit Provider</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter provider name"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter description"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Auth URL *
          </label>
          <input
            v-model="form.auth_url"
            type="url"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://example.com:5000/v3"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Identity Version
          </label>
          <input
            v-model="form.identity_version"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="v3"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Region Name *
          </label>
          <input
            v-model="form.region_name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter region name"
          />
        </div>

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
            Password
          </label>
          <input
            v-model="form.password"
            type="password"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Leave blank to keep current password"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Project Name *
          </label>
          <input
            v-model="form.project_name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter project name"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Domain Name
          </label>
          <input
            v-model="form.domain_name"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter domain name"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Domain ID
          </label>
          <input
            v-model="form.domain_id"
            type="text"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter domain ID"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Enabled
          </label>
          <div class="flex items-center">
            <input
              v-model="form.enabled"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label class="ml-2 text-sm text-gray-300">Enable this provider</label>
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
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
            <span v-else>Update Provider</span>
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
  name: 'EditProviderModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    provider: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const form = ref({
      name: '',
      description: '',
      auth_url: '',
      identity_version: '',
      region_name: '',
      username: '',
      password: '',
      project_name: '',
      domain_name: '',
      domain_id: '',
      enabled: true
    })

    const resetForm = () => {
      form.value = {
        name: '',
        description: '',
        auth_url: '',
        identity_version: '',
        region_name: '',
        username: '',
        password: '',
        project_name: '',
        domain_name: '',
        domain_id: '',
        enabled: true
      }
    }

    const populateForm = () => {
      if (props.provider) {
        form.value = {
          name: props.provider.name || '',
          description: props.provider.description || '',
          auth_url: props.provider.auth_url || '',
          identity_version: props.provider.identity_version || '',
          region_name: props.provider.region_name || '',
          username: props.provider.username || '',
          password: '',
          project_name: props.provider.project_name || '',
          domain_name: props.provider.domain_name || '',
          domain_id: props.provider.domain_id || '',
          enabled: props.provider.enabled !== undefined ? props.provider.enabled : true
        }
      }
    }

    const handleSubmit = async () => {
      if (!props.provider) return

      loading.value = true
      try {
        const updateData = { ...form.value }
        if (!updateData.password) {
          delete updateData.password
        }
        
        await api.providers.update(props.provider.id, updateData)
        emit('updated')
        emit('close')
      } catch (error) {
        console.error('Error updating provider:', error)
        const errorMessage = error.response?.data?.error || 'Failed to update provider'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Load data when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        populateForm()
      } else {
        resetForm()
      }
    })

    // Update form when provider prop changes
    watch(() => props.provider, () => {
      if (props.show && props.provider) {
        populateForm()
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