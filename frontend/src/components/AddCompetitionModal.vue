<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Add New Competition</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Competition Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter competition name"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter competition description"
          ></textarea>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Provider</label>
          <select
            v-model="form.provider_id"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a provider</option>
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">OpenStack Project Name</label>
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
        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Creating...</span>
            <span v-else>Create Competition</span>
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
  name: 'AddCompetitionModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    providers: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'created', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const loadingProjects = ref(false)
    const projects = ref([])
    const projectError = ref('')
    const form = ref({
      name: '',
      description: '',
      provider_id: '',
      openstack_project_name: ''
    })

    const resetForm = () => {
      form.value = {
        name: '',
        description: '',
        provider_id: '',
        openstack_project_name: ''
      }
      projects.value = []
      projectError.value = ''
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

    const handleSubmit = async () => {
      loading.value = true
      try {
        await api.workshops.create(form.value)
        emit('created')
        emit('close')
        resetForm()
      } catch (error) {
        console.error('Error creating competition:', error)
        // Emit error event for parent to handle
        emit('error', error.response?.data?.error || 'Failed to create competition')
      } finally {
        loading.value = false
      }
    }

    // Watch for provider changes to fetch projects
    watch(() => form.value.provider_id, (newProviderId) => {
      if (newProviderId) {
        fetchProjects(newProviderId)
      } else {
        projects.value = []
        form.value.openstack_project_name = ''
      }
    })

    // Reset form when modal closes
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        resetForm()
      }
    })

    return {
      loading,
      loadingProjects,
      projects,
      projectError,
      form,
      handleSubmit
    }
  }
}
</script> 