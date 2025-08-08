<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Bulk Assign Instances</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Select Instances
          </label>
          <div class="max-h-48 overflow-y-auto border border-gray-600 rounded-md p-2">
            <div v-for="instance in availableInstances" :key="instance.id" class="flex items-center mb-2">
              <input
                :id="`instance-${instance.id}`"
                v-model="selectedInstances"
                :value="instance.id"
                type="checkbox"
                class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label :for="`instance-${instance.id}`" class="ml-2 text-sm text-gray-300">
                {{ instance.name }} ({{ instance.status }}) - {{ instance.ip_addresses || 'No IP' }}
              </label>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Assign To
          </label>
          <select
            v-model="assignType"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="team">Team</option>
            <option value="user">User</option>
          </select>
        </div>

        <div v-if="assignType === 'team'">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Select Team
          </label>
          <select
            v-model="selectedTeam"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a team...</option>
            <option v-for="team in teams" :key="team.id" :value="team.id">
              {{ team.name }} ({{ team.workshop_name }})
            </option>
          </select>
        </div>

        <div v-if="assignType === 'user'">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Select User
          </label>
          <select
            v-model="selectedUser"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a user...</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.first_name }} {{ user.last_name }} ({{ user.username }})
            </option>
          </select>
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
            :disabled="loading || !canSubmit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <span v-if="loading" class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Assigning...
            </span>
            <span v-else>Assign Instances</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import api from '@/services/api'

export default {
  name: 'BulkAssignModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    instances: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'assigned', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const teams = ref([])
    const users = ref([])
    const selectedInstances = ref([])
    const assignType = ref('team')
    const selectedTeam = ref('')
    const selectedUser = ref('')

    const availableInstances = computed(() => {
      return props.instances.filter(instance => !instance.team_id && !instance.user_id)
    })

    const canSubmit = computed(() => {
      if (selectedInstances.value.length === 0) return false
      if (assignType.value === 'team' && !selectedTeam.value) return false
      if (assignType.value === 'user' && !selectedUser.value) return false
      return true
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
      selectedInstances.value = []
      assignType.value = 'team'
      selectedTeam.value = ''
      selectedUser.value = ''
    }

    const handleSubmit = async () => {
      if (!canSubmit.value) return

      loading.value = true
      try {
        const assignData = {
          instance_ids: selectedInstances.value,
          assign_type: assignType.value
        }

        if (assignType.value === 'team') {
          assignData.team_id = selectedTeam.value
        } else {
          assignData.user_id = selectedUser.value
        }

        await api.instances.bulkAssign(assignData)
        emit('assigned')
        emit('close')
        resetForm()
      } catch (error) {
        console.error('Error bulk assigning instances:', error)
        const errorMessage = error.response?.data?.error || 'Failed to assign instances'
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
      } else {
        resetForm()
      }
    })

    return {
      loading,
      teams,
      users,
      selectedInstances,
      assignType,
      selectedTeam,
      selectedUser,
      availableInstances,
      canSubmit,
      handleSubmit
    }
  }
}
</script> 