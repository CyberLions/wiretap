<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Edit Workshop</h3>
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
            placeholder="Enter workshop name"
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
            Provider *
          </label>
          <select
            v-model="form.provider_id"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a provider...</option>
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            OpenStack Project Name *
          </label>
          <input
            v-model="form.openstack_project_name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter OpenStack project name"
          />
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
            <span v-else>Update Workshop</span>
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
  name: 'EditWorkshopModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    workshop: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const providers = ref([])
    const form = ref({
      name: '',
      description: '',
      provider_id: '',
      openstack_project_name: ''
    })

    const fetchProviders = async () => {
      try {
        const response = await api.providers.getAll()
        providers.value = response.data
      } catch (error) {
        console.error('Error fetching providers:', error)
      }
    }

    const resetForm = () => {
      form.value = {
        name: '',
        description: '',
        provider_id: '',
        openstack_project_name: ''
      }
    }

    const populateForm = () => {
      if (props.workshop) {
        form.value = {
          name: props.workshop.name || '',
          description: props.workshop.description || '',
          provider_id: props.workshop.provider_id || '',
          openstack_project_name: props.workshop.openstack_project_name || ''
        }
      }
    }

    const handleSubmit = async () => {
      if (!props.workshop) return

      loading.value = true
      try {
        await api.workshops.update(props.workshop.id, form.value)
        emit('updated')
        emit('close')
      } catch (error) {
        console.error('Error updating workshop:', error)
        const errorMessage = error.response?.data?.error || 'Failed to update workshop'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Load data when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        fetchProviders()
        populateForm()
      } else {
        resetForm()
      }
    })

    // Update form when workshop prop changes
    watch(() => props.workshop, () => {
      if (props.show && props.workshop) {
        populateForm()
      }
    })

    return {
      loading,
      providers,
      form,
      handleSubmit
    }
  }
}
</script> 