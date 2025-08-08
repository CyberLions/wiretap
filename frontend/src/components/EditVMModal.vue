<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-8">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Edit VM Instance</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Instance Name
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter instance name"
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
            Assign To Team
          </label>
          <select
            v-model="form.team_id"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No team assignment</option>
            <option v-for="team in teams" :key="team.id" :value="team.id">
              {{ team.name }} ({{ team.workshop_name }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Assign To User
          </label>
          <select
            v-model="form.user_id"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No user assignment</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.first_name }} {{ user.last_name }} ({{ user.username }})
            </option>
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
            Instance is enabled
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
              Updating...
            </span>
            <span v-else>Update VM</span>
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
  name: 'EditVMModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    vm: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const teams = ref([])
    const users = ref([])
    const form = ref({
      name: '',
      description: '',
      team_id: '',
      user_id: '',
      enabled: true
    })

    const fetchTeams = async () => {
      try {
        const response = await api.teams.getAll()
        teams.value = response.data
      } catch (error) {
        console.error('Error fetching teams:', error)
      }
    }

    const fetchUsers = async () => {
      try {
        const response = await api.users.getAll()
        users.value = response.data
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    const resetForm = () => {
      form.value = {
        name: '',
        description: '',
        team_id: '',
        user_id: '',
        enabled: true
      }
    }

    const populateForm = () => {
      if (props.vm) {
        form.value = {
          name: props.vm.name || '',
          description: props.vm.description || '',
          team_id: props.vm.team_id || '',
          user_id: props.vm.user_id || '',
          enabled: props.vm.enabled !== false
        }
      }
    }

    const handleSubmit = async () => {
      if (!props.vm) return

      loading.value = true
      try {
        await api.instances.update(props.vm.id, form.value)
        emit('updated')
        emit('close')
      } catch (error) {
        console.error('Error updating VM:', error)
        const errorMessage = error.response?.data?.error || 'Failed to update VM'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Load data when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        fetchTeams()
        fetchUsers()
        populateForm()
      } else {
        resetForm()
      }
    })

    // Update form when VM prop changes
    watch(() => props.vm, () => {
      if (props.show && props.vm) {
        populateForm()
      }
    })

    return {
      loading,
      teams,
      users,
      form,
      handleSubmit
    }
  }
}
</script> 