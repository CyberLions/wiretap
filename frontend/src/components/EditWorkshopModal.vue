<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop">
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
          <select
            v-model="form.openstack_project_name"
            required
            :disabled="!form.provider_id || loadingProjects"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a project</option>
            <option v-for="project in projects" :key="project.id" :value="project.name">
              {{ project.name }}
            </option>
          </select>
          <div v-if="loadingProjects" class="mt-1 text-sm text-gray-400">
            Loading projects...
          </div>
          <div v-if="projectError" class="mt-1 text-sm text-red-400">
            {{ projectError }}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Workshop Start (optional)
            </label>
            <input
              v-model="form.lockout_start"
              type="datetime-local"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p class="text-xs text-gray-400 mt-1">Time will be interpreted in your local timezone</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Workshop End (optional)
            </label>
            <input
              v-model="form.lockout_end"
              type="datetime-local"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p class="text-xs text-gray-400 mt-1">Time will be interpreted in your local timezone</p>
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
            <span v-else>Update Workshop</span>
          </button>
        </div>
      </form>
    </div>
    </div>
  </Teleport>
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
    const loadingProjects = ref(false)
    const providers = ref([])
    const projects = ref([])
    const projectError = ref('')
    const form = ref({
      name: '',
      description: '',
      provider_id: '',
      openstack_project_name: '',
      lockout_start: '',
      lockout_end: ''
    })

    const toDateTimeLocal = (value) => {
      if (!value) return ''
      // The backend returns MySQL TIMESTAMP ("YYYY-MM-DD HH:MM:SS") or ISO.
      // Normalize to input[type=datetime-local] format: "YYYY-MM-DDTHH:MM" (no seconds)
      try {
        const date = new Date(typeof value === 'string' && value.includes(' ') ? value.replace(' ', 'T') + 'Z' : value)
        if (isNaN(date)) return ''
        const pad = (n) => String(n).padStart(2, '0')
        const yyyy = date.getFullYear()
        const mm = pad(date.getMonth() + 1)
        const dd = pad(date.getDate())
        const hh = pad(date.getHours())
        const min = pad(date.getMinutes())
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`
      } catch {
        return ''
      }
    }

    const fetchProviders = async () => {
      try {
        const response = await api.providers.getAll()
        providers.value = response.data
      } catch (error) {
        console.error('Error fetching providers:', error)
      }
    }

    const fetchProjects = async (providerId) => {
      if (!providerId) {
        projects.value = []
        return
      }

      loadingProjects.value = true
      projectError.value = ''

      try {
        const response = await api.providers.getProjects(providerId)
        if (response.data.success) {
          projects.value = response.data.projects || []
        } else {
          projectError.value = response.data.error || 'Failed to fetch projects'
          projects.value = []
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
        projectError.value = error.response?.data?.error || 'Failed to fetch projects'
        projects.value = []
      } finally {
        loadingProjects.value = false
      }
    }

    const resetForm = () => {
      form.value = {
        name: '',
        description: '',
        provider_id: '',
        openstack_project_name: '',
        lockout_start: '',
        lockout_end: ''
      }
      projects.value = []
      projectError.value = ''
    }

    const populateForm = () => {
      if (props.workshop) {
        form.value = {
          name: props.workshop.name || '',
          description: props.workshop.description || '',
          provider_id: props.workshop.provider_id || '',
          openstack_project_name: props.workshop.openstack_project_name || '',
          lockout_start: toDateTimeLocal(props.workshop.lockout_start),
          lockout_end: toDateTimeLocal(props.workshop.lockout_end)
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

    // Watch for provider changes to fetch projects
    watch(() => form.value.provider_id, (newProviderId) => {
      if (newProviderId) {
        fetchProjects(newProviderId)
      } else {
        projects.value = []
        form.value.openstack_project_name = ''
      }
    })

    return {
      loading,
      loadingProjects,
      providers,
      projects,
      projectError,
      form,
      handleSubmit,
      toDateTimeLocal
    }
  }
}
</script> 