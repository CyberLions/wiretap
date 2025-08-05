<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading workshop details...</span>
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
            <h3 class="text-sm font-medium text-red-400">Error loading workshop</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Workshop details -->
      <div v-else-if="workshop" class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">{{ workshop.name }}</h1>
            <p class="text-gray-400 mt-2">{{ workshop.description || 'No description' }}</p>
          </div>
          <div class="flex items-center space-x-4">
            <span 
              :class="[
                'status-badge px-3 py-1',
                workshop.enabled ? 'status-active' : 'status-inactive'
              ]"
            >
              {{ workshop.enabled ? 'Active' : 'Inactive' }}
            </span>
            <button 
              v-if="isAdmin"
              class="btn btn-primary"
              @click="editWorkshop"
            >
              Edit Workshop
            </button>
          </div>
        </div>

        <!-- Workshop info -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Workshop Information</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex justify-between">
                <span class="text-gray-500">Provider:</span>
                <span class="text-gray-300">{{ workshop.provider_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">OpenStack Project:</span>
                <span class="text-gray-300">{{ workshop.openstack_project_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Project ID:</span>
                <span class="text-gray-300 font-mono text-sm">{{ workshop.openstack_project_id }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created:</span>
                <span class="text-gray-300">{{ formatDate(workshop.created_at) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Last Updated:</span>
                <span class="text-gray-300">{{ formatDate(workshop.updated_at) }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Statistics</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex justify-between">
                <span class="text-gray-500">Total Teams:</span>
                <span class="text-gray-300">{{ stats.team_count || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Total Instances:</span>
                <span class="text-gray-300">{{ stats.instance_count || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Active Instances:</span>
                <span class="text-gray-300">{{ stats.active_instances || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Total Users:</span>
                <span class="text-gray-300">{{ stats.user_count || 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Teams section -->
        <div class="card">
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Teams</h3>
              <button 
                v-if="isAdmin"
                class="btn btn-primary"
                @click="createTeam"
              >
                Create Team
              </button>
            </div>
          </div>
          <div class="card-body">
            <div v-if="teamsLoading" class="flex justify-center py-8">
              <div class="spinner w-6 h-6"></div>
            </div>
            <div v-else-if="teams.length === 0" class="text-center py-8">
              <p class="text-gray-400">No teams found in this workshop.</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div 
                v-for="team in teams" 
                :key="team.id"
                class="border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors cursor-pointer"
                @click="viewTeam(team.id)"
              >
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-white">{{ team.name }}</h4>
                  <span 
                    :class="[
                      'status-badge text-xs',
                      team.enabled ? 'status-active' : 'status-inactive'
                    ]"
                  >
                    {{ team.enabled ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <p class="text-gray-400 text-sm mb-3">{{ team.description || 'No description' }}</p>
                <div class="text-sm text-gray-500">
                  <div class="flex justify-between">
                    <span>Members:</span>
                    <span class="text-gray-300">{{ team.member_count || 0 }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Instances:</span>
                    <span class="text-gray-300">{{ team.instance_count || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Instances section -->
        <div class="card">
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">Instances</h3>
              <button 
                v-if="isAdmin"
                class="btn btn-primary"
                @click="refreshInstances"
              >
                Refresh Instances
              </button>
            </div>
          </div>
          <div class="card-body">
            <div v-if="instancesLoading" class="flex justify-center py-8">
              <div class="spinner w-6 h-6"></div>
            </div>
            <div v-else-if="instances.length === 0" class="text-center py-8">
              <p class="text-gray-400">No instances found in this workshop.</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table">
                <thead class="table-header">
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Power State</th>
                    <th>Team</th>
                    <th>User</th>
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
                    <td class="table-cell">{{ instance.team_name || '-' }}</td>
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
  name: 'WorkshopDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    
    const workshop = ref(null)
    const teams = ref([])
    const instances = ref([])
    const stats = ref({})
    const loading = ref(true)
    const teamsLoading = ref(false)
    const instancesLoading = ref(false)
    const error = ref(null)

    const isAdmin = computed(() => authStore.isAdmin)

    const fetchWorkshop = async () => {
      try {
        loading.value = true
        error.value = null
        
        const response = await api.get(`/workshops/${route.params.id}`)
        workshop.value = response.data
      } catch (err) {
        console.error('Error fetching workshop:', err)
        error.value = err.response?.data?.message || 'Failed to load workshop'
      } finally {
        loading.value = false
      }
    }

    const fetchTeams = async () => {
      try {
        teamsLoading.value = true
        const response = await api.get(`/workshops/${route.params.id}/teams`)
        teams.value = response.data
      } catch (err) {
        console.error('Error fetching teams:', err)
      } finally {
        teamsLoading.value = false
      }
    }

    const fetchInstances = async () => {
      try {
        instancesLoading.value = true
        const response = await api.get(`/workshops/${route.params.id}/instances`)
        instances.value = response.data
      } catch (err) {
        console.error('Error fetching instances:', err)
      } finally {
        instancesLoading.value = false
      }
    }

    const fetchStats = async () => {
      try {
        const response = await api.get(`/workshops/${route.params.id}/stats`)
        stats.value = response.data
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }

    const viewTeam = (id) => {
      router.push(`/teams/${id}`)
    }

    const viewInstance = (id) => {
      router.push(`/instances/${id}`)
    }

    const openConsole = (id) => {
      router.push(`/console/${id}`)
    }

    const editWorkshop = () => {
      // TODO: Implement edit workshop modal
      console.log('Edit workshop')
    }

    const createTeam = () => {
      // TODO: Implement create team modal
      console.log('Create team')
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
      fetchWorkshop()
      fetchTeams()
      fetchInstances()
      fetchStats()
    })

    return {
      workshop,
      teams,
      instances,
      stats,
      loading,
      teamsLoading,
      instancesLoading,
      error,
      isAdmin,
      viewTeam,
      viewInstance,
      openConsole,
      editWorkshop,
      createTeam,
      refreshInstances,
      canAccessInstance,
      getStatusClass,
      formatDate
    }
  }
}
</script> 