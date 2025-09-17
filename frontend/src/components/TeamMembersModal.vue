<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop">
    <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Manage Team Members - {{ team?.name }}</h3>
      </div>
      
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        <!-- Current Team Members -->
        <div class="mb-6">
          <h4 class="text-md font-medium text-white mb-4">Current Team Members</h4>
          <div v-if="loading" class="text-center py-4">
            <div class="spinner w-6 h-6 mx-auto mb-2"></div>
            <p class="text-gray-400">Loading team members...</p>
          </div>
          <div v-else-if="teamMembers.length === 0" class="text-center py-8">
            <p class="text-gray-400">No team members yet.</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="member in teamMembers"
              :key="member.id"
              class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-sm font-medium">
                    {{ member.first_name?.[0] || member.username?.[0] || 'U' }}
                  </span>
                </div>
                <div>
                  <p class="text-white font-medium">
                    {{ member.first_name }} {{ member.last_name }}
                  </p>
                  <p class="text-gray-400 text-sm">{{ member.username }}</p>
                </div>
              </div>
              <button
                @click="removeUser(member.id)"
                :disabled="removingUser === member.id"
                class="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="removingUser === member.id">Removing...</span>
                <span v-else>Remove</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Add New Member -->
        <div class="border-t border-gray-700 pt-6">
          <h4 class="text-md font-medium text-white mb-4">Add New Member</h4>
          <div class="flex space-x-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-300 mb-2">Select User</label>
              <select
                v-model="selectedUserId"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a user to add</option>
                <option
                  v-for="user in availableUsers"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.first_name }} {{ user.last_name }} ({{ user.username }})
                </option>
              </select>
            </div>
            <div class="flex items-end">
              <button
                @click="addUser"
                :disabled="!selectedUserId || addingUser"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="addingUser">Adding...</span>
                <span v-else>Add User</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Add Member by Email -->
        <div class="border-t border-gray-700 pt-6">
          <h4 class="text-md font-medium text-white mb-4">Add Member by Email</h4>
          <div class="flex space-x-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <input
                v-model="newMemberEmail"
                type="email"
                placeholder="Enter email address"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div class="flex items-end">
              <button
                @click="addUserByEmail"
                :disabled="!newMemberEmail || addingUserByEmail"
                class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="addingUserByEmail">Adding...</span>
                <span v-else>Add by Email</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Pending Team Assignments -->
        <div class="border-t border-gray-700 pt-6">
          <h4 class="text-md font-medium text-white mb-4">Pending Team Assignments</h4>
          <div v-if="pendingLoading" class="text-center py-4">
            <div class="spinner w-6 h-6 mx-auto mb-2"></div>
            <p class="text-gray-400">Loading pending assignments...</p>
          </div>
          <div v-else-if="pendingAssignments.length === 0" class="text-center py-4">
            <p class="text-gray-400">No pending team assignments.</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="assignment in pendingAssignments"
              :key="assignment.id"
              class="flex items-center justify-between p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-sm font-medium">
                    {{ assignment.email[0].toUpperCase() }}
                  </span>
                </div>
                <div>
                  <p class="text-white font-medium">{{ assignment.email }}</p>
                  <p class="text-yellow-400 text-sm">Pending - User will be added when they create an account</p>
                </div>
              </div>
              <button
                @click="removePendingAssignment(assignment.id)"
                :disabled="removingPending === assignment.id"
                class="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="removingPending === assignment.id">Removing...</span>
                <span v-else>Remove</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-700">
        <div class="flex justify-end">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import api from '@/services/api'

export default {
  name: 'TeamMembersModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    team: {
      type: Object,
      default: null
    },
    allUsers: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const addingUser = ref(false)
    const removingUser = ref(null)
    const teamMembers = ref([])
    const selectedUserId = ref('')
    const newMemberEmail = ref('')
    const addingUserByEmail = ref(false)
    const pendingAssignments = ref([])
    const pendingLoading = ref(false)
    const removingPending = ref(null)

    // Computed property for available users (users not already in the team)
    const availableUsers = computed(() => {
      const memberIds = teamMembers.value.map(member => member.id)
      return props.allUsers.filter(user => !memberIds.includes(user.id))
    })

    const loadTeamMembers = async () => {
      if (!props.team?.id) return
      
      loading.value = true
      try {
        const response = await api.teams.getUsers(props.team.id)
        teamMembers.value = response.data
      } catch (error) {
        console.error('Error loading team members:', error)
        emit('error', 'Failed to load team members')
      } finally {
        loading.value = false
      }
    }

    const addUser = async () => {
      if (!selectedUserId.value || !props.team?.id) return
      
      addingUser.value = true
      try {
        await api.teams.addUser(props.team.id, selectedUserId.value)
        await loadTeamMembers()
        selectedUserId.value = ''
        emit('updated')
      } catch (error) {
        console.error('Error adding user to team:', error)
        emit('error', error.response?.data?.error || 'Failed to add user to team')
      } finally {
        addingUser.value = false
      }
    }

    const removeUser = async (userId) => {
      if (!props.team?.id) return
      
      removingUser.value = userId
      try {
        await api.teams.removeUser(props.team.id, userId)
        await loadTeamMembers()
        emit('updated')
      } catch (error) {
        console.error('Error removing user from team:', error)
        emit('error', error.response?.data?.error || 'Failed to remove user from team')
      } finally {
        removingUser.value = null
      }
    }

    const loadPendingAssignments = async () => {
      if (!props.team?.id) return
      
      pendingLoading.value = true
      try {
        const response = await api.teams.getPendingAssignmentsForTeam(props.team.id)
        pendingAssignments.value = response.data.pending_assignments || []
      } catch (error) {
        console.error('Error loading pending assignments:', error)
        emit('error', 'Failed to load pending assignments')
      } finally {
        pendingLoading.value = false
      }
    }

    const addUserByEmail = async () => {
      if (!newMemberEmail.value || !props.team?.id) return
      
      addingUserByEmail.value = true
      try {
        await api.teams.addUserByEmail(props.team.id, newMemberEmail.value)
        newMemberEmail.value = ''
        await loadPendingAssignments()
        emit('updated')
      } catch (error) {
        console.error('Error adding user by email:', error)
        emit('error', error.response?.data?.error || 'Failed to add user by email')
      } finally {
        addingUserByEmail.value = false
      }
    }

    const removePendingAssignment = async (assignmentId) => {
      if (!props.team?.id) return
      
      removingPending.value = assignmentId
      try {
        // Find the assignment to get the email
        const assignment = pendingAssignments.value.find(a => a.id === assignmentId)
        if (assignment) {
          await api.users.removePendingTeamAssignment(assignment.email, props.team.id)
          await loadPendingAssignments()
          emit('updated')
        }
      } catch (error) {
        console.error('Error removing pending assignment:', error)
        emit('error', error.response?.data?.error || 'Failed to remove pending assignment')
      } finally {
        removingPending.value = null
      }
    }

    // Load team members when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal && props.team?.id) {
        loadTeamMembers()
        loadPendingAssignments()
        selectedUserId.value = ''
        newMemberEmail.value = ''
      }
    })

    // Load team members when team changes
    watch(() => props.team, (newTeam) => {
      if (newTeam?.id && props.show) {
        loadTeamMembers()
        loadPendingAssignments()
      }
    })

    return {
      loading,
      addingUser,
      removingUser,
      teamMembers,
      selectedUserId,
      availableUsers,
      addUser,
      removeUser,
      newMemberEmail,
      addingUserByEmail,
      pendingAssignments,
      pendingLoading,
      removingPending,
      addUserByEmail,
      removePendingAssignment
    }
  }
}
</script>

<style scoped>
.spinner {
  border: 2px solid #374151;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
