<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading team details...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-400">Error loading team</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Team details -->
      <div v-else-if="team" class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">{{ team.name }}</h1>
            <p class="text-gray-400 mt-2">{{ team.description || 'No description' }}</p>
          </div>
          <div class="flex items-center space-x-4">
            <span 
              :class="[
                'status-badge px-3 py-1',
                team.enabled ? 'status-active' : 'status-inactive'
              ]"
            >
              {{ team.enabled ? 'Active' : 'Inactive' }}
            </span>
            <button 
              v-if="isAdmin"
              class="btn btn-primary"
              @click="editTeam"
            >
              Edit Team
            </button>
          </div>
        </div>

        <!-- Team info -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Team Information</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex justify-between">
                <span class="text-gray-500">Workshop:</span>
                <span class="text-gray-300">{{ team.workshop_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Team Number:</span>
                <span class="text-gray-300">{{ team.team_number }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Members:</span>
                <span class="text-gray-300">{{ team.member_count || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Instances:</span>
                <span class="text-gray-300">{{ team.instance_count || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created:</span>
                <span class="text-gray-300">{{ formatDate(team.created_at) }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Quick Actions</h3>
            </div>
            <div class="card-body space-y-3">
              <button 
                v-if="isAdmin"
                class="w-full btn btn-primary"
                @click="addMember"
              >
                Add Member
              </button>
              <button 
                v-if="isAdmin"
                class="w-full btn btn-secondary"
                @click="bulkCreateUsers"
              >
                Bulk Create Users
              </button>
              <button 
                class="w-full btn btn-secondary"
                @click="viewInstances"
              >
                View Instances
              </button>
            </div>
          </div>
        </div>

        <!-- Members section -->
        <div class="card">
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Team Members</h3>
              <button 
                v-if="isAdmin"
                class="btn btn-primary"
                @click="addMember"
              >
                Add Member
              </button>
            </div>
          </div>
          <div class="card-body">
            <div v-if="membersLoading" class="flex justify-center py-8">
              <div class="spinner w-6 h-6"></div>
            </div>
            <div v-else-if="members.length === 0" class="text-center py-8">
              <p class="text-gray-400">No members found in this team.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table">
                <thead class="table-header">
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Auth Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody class="table-body">
                  <tr 
                    v-for="member in members" 
                    :key="member.id"
                    class="table-row"
                  >
                    <td class="table-cell">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8">
                          <div class="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-sm font-medium text-white">
                              {{ member.first_name?.[0] || member.username?.[0] || 'U' }}
                            </span>
                          </div>
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-medium text-white">
                            {{ member.first_name }} {{ member.last_name }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="table-cell">{{ member.username }}</td>
                    <td class="table-cell">{{ member.email || '-' }}</td>
                    <td class="table-cell">
                      <span 
                        :class="[
                          'status-badge text-xs',
                          member.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        ]"
                      >
                        {{ member.role }}
                      </span>
                    </td>
                    <td class="table-cell">
                      <span 
                        :class="[
                          'status-badge text-xs',
                          member.auth_type === 'OPENID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        ]"
                      >
                        {{ member.auth_type }}
                      </span>
                    </td>
                    <td class="table-cell">
                      <div class="flex space-x-2">
                        <button 
                          v-if="isAdmin"
                          class="btn btn-danger text-xs"
                          @click="removeMember(member.id)"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Instances section -->
        <div class="card">
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Team Instances</h3>
              <button 
                class="btn btn-secondary"
                @click="refreshInstances"
              >
                Refresh
              </button>
            </div>
          </div>
          <div class="card-body">
            <div v-if="instancesLoading" class="flex justify-center py-8">
              <div class="spinner w-6 h-6"></div>
            </div>
            <div v-else-if="instances.length === 0" class="text-center py-8">
              <p class="text-gray-400">No instances assigned to this team.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table">
                <thead class="table-header">
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Power State</th>
                    <th>Assigned User</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody class="table-body">
                  <tr 
                    v-for="instance in instances" 
                    :key="instance.id"
                    class="table-row"
                  >
                    <td class="table-cell font-medium">{{ instance.name }}</td>
                    <td class="table-cell">
                      <span 
                        :class="[
                          'status-badge',
                          getStatusClass(instance.status)
                        ]"
                      >
                        {{ instance.status }}
                      </span>
                    </td>
                    <td class="table-cell">{{ instance.power_state }}</td>
                    <td class="table-cell">{{ instance.user_name || '-' }}</td>
                    <td class="table-cell">
                      <div class="flex space-x-2">
                        <button 
                          class="btn btn-primary text-xs"
                          @click="viewInstance(instance.id)"
                        >
                          View
                        </button>
                        <button 
                          v-if="canAccessInstance(instance)"
                          class="btn btn-secondary text-xs"
                          @click="openConsole(instance.id)"
                        >
                          Console
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

export default {
  name: 'TeamDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    
    const team = ref(null)
    const members = ref([])
    const instances = ref([])
    const loading = ref(true)
    const membersLoading = ref(false)
    const instancesLoading = ref(false)
    const error = ref(null)

    const isAdmin = computed(() => authStore.isAdmin)

    const fetchTeam = async () => {
      try {
        loading.value = true
        error.value = null
        
        const response = await api.get(`/teams/${route.params.id}`)
        team.value = response.data
      } catch (err) {
        console.error('Error fetching team:', err)
        error.value = err.response?.data?.message || 'Failed to load team'
      } finally {
        loading.value = false
      }
    }

    const fetchMembers = async () => {
      try {
        membersLoading.value = true
        const response = await api.get(`/teams/${route.params.id}/members`)
        members.value = response.data
      } catch (err) {
        console.error('Error fetching members:', err)
      } finally {
        membersLoading.value = false
      }
    }

    const fetchInstances = async () => {
      try {
        instancesLoading.value = true
        const response = await api.get(`/teams/${route.params.id}/instances`)
        instances.value = response.data
      } catch (err) {
        console.error('Error fetching instances:', err)
      } finally {
        instancesLoading.value = false
      }
    }

    const viewInstance = (id) => {
      router.push(`/instances/${id}`)
    }

    const openConsole = (id) => {
      router.push(`/console/${id}`)
    }

    const editTeam = () => {
      // TODO: Implement edit team modal
      console.log('Edit team')
    }

    const addMember = () => {
      // TODO: Implement add member modal
      console.log('Add member')
    }

    const removeMember = async (userId) => {
      if (!confirm('Are you sure you want to remove this member from the team?')) {
        return
      }
      
      try {
        await api.delete(`/teams/${route.params.id}/members/${userId}`)
        await fetchMembers()
      } catch (err) {
        console.error('Error removing member:', err)
      }
    }

    const bulkCreateUsers = () => {
      // TODO: Implement bulk user creation modal
      console.log('Bulk create users')
    }

    const viewInstances = () => {
      // TODO: Navigate to instances view filtered by team
      console.log('View instances')
    }

    const refreshInstances = async () => {
      await fetchInstances()
    }

    const canAccessInstance = (instance) => {
      if (isAdmin.value) return true
      return instance.user_id === authStore.user?.id || 
             (instance.team_id && authStore.userTeams.includes(instance.team_id))
    }

    const getStatusClass = (status) => {
      switch (status?.toLowerCase()) {
        case 'active':
        case 'running':
          return 'status-active'
        case 'inactive':
        case 'stopped':
        case 'shutoff':
          return 'status-inactive'
        default:
          return 'status-pending'
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString()
    }

    onMounted(() => {
      fetchTeam()
      fetchMembers()
      fetchInstances()
    })

    return {
      team,
      members,
      instances,
      loading,
      membersLoading,
      instancesLoading,
      error,
      isAdmin,
      viewInstance,
      openConsole,
      editTeam,
      addMember,
      removeMember,
      bulkCreateUsers,
      viewInstances,
      refreshInstances,
      canAccessInstance,
      getStatusClass,
      formatDate
    }
  }
}
</script> 