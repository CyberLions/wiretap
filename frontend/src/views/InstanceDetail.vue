<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading instance details...</span>
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
            <h3 class="text-sm font-medium text-red-400">Error loading instance</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Instance details -->
      <div v-else-if="instance" class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">{{ instance.name }}</h1>
            <p class="text-gray-400 mt-2">{{ instance.workshop_name }} - {{ instance.openstack_id }}</p>
          </div>
          <div class="flex items-center space-x-4">
            <span 
              :class="[
                'status-badge px-3 py-1',
                getStatusClass(instance.status)
              ]"
            >
              {{ instance.status }}
            </span>
            <span 
              :class="[
                'status-badge px-3 py-1',
                getPowerStateClass(instance.power_state)
              ]"
            >
              {{ instance.power_state }}
            </span>
            <button 
              v-if="canAccessInstance"
              class="btn btn-primary"
              @click="openConsole"
            >
              Open Console
            </button>
          </div>
        </div>

        <!-- Instance info -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Instance Information</h3>
            </div>
            <div class="card-body space-y-4">
              <div class="flex justify-between">
                <span class="text-gray-500">OpenStack ID:</span>
                <span class="text-gray-300 font-mono text-sm">{{ instance.openstack_id }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Workshop:</span>
                <span class="text-gray-300">{{ instance.workshop_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Team:</span>
                <span class="text-gray-300">{{ instance.team_name || 'Unassigned' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Assigned User:</span>
                <span class="text-gray-300">{{ instance.user_name || 'Unassigned' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Flavor:</span>
                <span class="text-gray-300">{{ instance.flavor || 'Unknown' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Image:</span>
                <span class="text-gray-300">{{ instance.image || 'Unknown' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Created:</span>
                <span class="text-gray-300">{{ formatDate(instance.created_at) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Last Updated:</span>
                <span class="text-gray-300">{{ formatDate(instance.updated_at) }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold text-white">Network Information</h3>
            </div>
            <div class="card-body space-y-4">
              <div v-if="instance.ip_addresses" class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-gray-500">IP Addresses:</span>
                </div>
                <div v-for="ip in parseIpAddresses(instance.ip_addresses)" :key="ip" class="text-gray-300 font-mono text-sm">
                  {{ ip }}
                </div>
              </div>
              <div v-else class="text-gray-500">
                No IP addresses available
              </div>
            </div>
          </div>
        </div>

        <!-- Power actions -->
        <div class="card">
          <div class="card-header">
            <h3 class="text-lg font-semibold text-white">Power Actions</h3>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                v-if="canAccessInstance"
                class="btn btn-success"
                @click="powerAction('start')"
                :disabled="instance.power_state === 'running'"
              >
                Start
              </button>
              <button 
                v-if="canAccessInstance"
                class="btn btn-secondary"
                @click="powerAction('stop')"
                :disabled="instance.power_state === 'shutoff'"
              >
                Stop
              </button>
              <button 
                v-if="canAccessInstance"
                class="btn btn-secondary"
                @click="powerAction('restart')"
                :disabled="instance.power_state === 'shutoff'"
              >
                Restart
              </button>
              <button 
                v-if="canAccessInstance"
                class="btn btn-danger"
                @click="powerAction('hard_reboot')"
                :disabled="instance.power_state === 'shutoff'"
              >
                Hard Reboot
              </button>
            </div>
          </div>
        </div>

        <!-- Assignment actions -->
        <div v-if="isAdmin" class="card">
          <div class="card-header">
            <h3 class="text-lg font-semibold text-white">Assignment</h3>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="form-label">Assign to Team</label>
                <select v-model="assignment.team_id" class="form-input">
                  <option value="">No Team</option>
                  <option v-for="team in teams" :key="team.id" :value="team.id">
                    {{ team.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="form-label">Assign to User</label>
                <select v-model="assignment.user_id" class="form-input">
                  <option value="">No User</option>
                  <option v-for="user in users" :key="user.id" :value="user.id">
                    {{ user.first_name }} {{ user.last_name }} ({{ user.username }})
                  </option>
                </select>
              </div>
            </div>
            <div class="mt-4">
              <button 
                class="btn btn-primary"
                @click="updateAssignment"
                :disabled="updating"
              >
                {{ updating ? 'Updating...' : 'Update Assignment' }}
              </button>
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
  name: 'InstanceDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    
    const instance = ref(null)
    const teams = ref([])
    const users = ref([])
    const loading = ref(true)
    const updating = ref(false)
    const error = ref(null)
    const assignment = ref({
      team_id: '',
      user_id: ''
    })

    const isAdmin = computed(() => authStore.isAdmin)
    const canAccessInstance = computed(() => {
      if (!instance.value) return false
      if (isAdmin.value) return true
      return instance.value.user_id === authStore.user?.id || 
             (instance.value.team_id && authStore.userTeams.includes(instance.value.team_id))
    })

    const fetchInstance = async () => {
      try {
        loading.value = true
        error.value = null
        
        const response = await api.get(`/instances/${route.params.id}`)
        instance.value = response.data
        
        // Set assignment values
        assignment.value.team_id = instance.value.team_id || ''
        assignment.value.user_id = instance.value.user_id || ''
      } catch (err) {
        console.error('Error fetching instance:', err)
        error.value = err.response?.data?.message || 'Failed to load instance'
      } finally {
        loading.value = false
      }
    }

    const fetchTeams = async () => {
      try {
        const response = await api.get('/teams')
        teams.value = response.data
      } catch (err) {
        console.error('Error fetching teams:', err)
      }
    }

    const fetchUsers = async () => {
      try {
        const response = await api.get('/users')
        users.value = response.data
      } catch (err) {
        console.error('Error fetching users:', err)
      }
    }

    const openConsole = () => {
      router.push(`/console/${route.params.id}`)
    }

    const powerAction = async (action) => {
      try {
        await api.post(`/instances/${route.params.id}/power`, { action })
        await fetchInstance()
      } catch (err) {
        console.error('Error performing power action:', err)
      }
    }

    const updateAssignment = async () => {
      try {
        updating.value = true
        await api.put(`/instances/${route.params.id}/assignment`, assignment.value)
        await fetchInstance()
      } catch (err) {
        console.error('Error updating assignment:', err)
      } finally {
        updating.value = false
      }
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
        case 'error':
          return 'bg-red-100 text-red-800'
        default:
          return 'status-pending'
      }
    }

    const getPowerStateClass = (powerState) => {
      switch (powerState?.toLowerCase()) {
        case 'running':
          return 'status-active'
        case 'stopped':
        case 'shutoff':
          return 'status-inactive'
        case 'suspended':
          return 'bg-yellow-100 text-yellow-800'
        default:
          return 'status-pending'
      }
    }

    const parseIpAddresses = (ipAddresses) => {
      if (!ipAddresses) return []
      try {
        return JSON.parse(ipAddresses)
      } catch {
        return [ipAddresses]
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString()
    }

    onMounted(() => {
      fetchInstance()
      fetchTeams()
      fetchUsers()
    })

    return {
      instance,
      teams,
      users,
      loading,
      updating,
      error,
      assignment,
      isAdmin,
      canAccessInstance,
      openConsole,
      powerAction,
      updateAssignment,
      getStatusClass,
      getPowerStateClass,
      parseIpAddresses,
      formatDate
    }
  }
}
</script> 