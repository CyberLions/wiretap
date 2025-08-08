<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Add Team Member</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Select User *
          </label>
          <select
            v-model="selectedUserId"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a user...</option>
            <option v-for="user in availableUsers" :key="user.id" :value="user.id">
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
            :disabled="loading || !selectedUserId"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <span v-if="loading" class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adding...
            </span>
            <span v-else>Add Member</span>
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
  name: 'AddMemberModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    teamId: {
      type: String,
      required: true
    },
    existingMembers: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'added', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const users = ref([])
    const selectedUserId = ref('')

    const availableUsers = computed(() => {
      const existingMemberIds = props.existingMembers.map(member => member.id)
      return users.value.filter(user => !existingMemberIds.includes(user.id))
    })

    const fetchUsers = async () => {
      try {
        const response = await api.users.getAll()
        users.value = response.data
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    const resetForm = () => {
      selectedUserId.value = ''
    }

    const handleSubmit = async () => {
      if (!selectedUserId.value) return

      loading.value = true
      try {
        await api.post(`/teams/${props.teamId}/members`, {
          user_id: selectedUserId.value
        })
        emit('added')
        emit('close')
        resetForm()
      } catch (error) {
        console.error('Error adding member:', error)
        const errorMessage = error.response?.data?.error || 'Failed to add member'
        emit('error', errorMessage)
      } finally {
        loading.value = false
      }
    }

    // Load data when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        fetchUsers()
      } else {
        resetForm()
      }
    })

    return {
      loading,
      users,
      selectedUserId,
      availableUsers,
      handleSubmit
    }
  }
}
</script> 