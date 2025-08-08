<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Instances</h1>
        <p class="text-gray-400">Manage virtual machine instances across workshops</p>
      </div>

      <!-- Filters -->
      <div class="card mb-6">
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="form-label">Workshop</label>
              <select v-model="filters.workshop" class="form-input">
                <option value="">All Workshops</option>
                <option v-for="workshop in workshops" :key="workshop.id" :value="workshop.id">
                  {{ workshop.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="form-label">Status</label>
              <select v-model="filters.status" class="form-input">
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="BUILD">Building</option>
                <option value="ERROR">Error</option>
              </select>
            </div>
            <div>
              <label class="form-label">Power State</label>
              <select v-model="filters.powerState" class="form-input">
                <option value="">All States</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
                <option value="shutoff">Shut Off</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div class="flex items-end">
              <button class="btn btn-primary w-full" @click="applyFilters">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading instances...</span>
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
            <h3 class="text-sm font-medium text-red-400">Error loading instances</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Instances table -->
      <div v-else class="card">
        <div class="card-header">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Instances ({{ instances.length }})</h3>
            <div class="flex space-x-2">
              <button 
                v-if="isAdmin"
                class="btn btn-secondary"
                @click="refreshInstances"
              >
                Refresh
              </button>
              <button 
                v-if="isAdmin"
                class="btn btn-warning"
                @click="syncInstances"
                :disabled="syncing"
              >
                {{ syncing ? 'Syncing...' : 'Sync from OpenStack' }}
              </button>
              <button 
                v-if="isAdmin"
                class="btn btn-primary"
                @click="bulkAssign"
              >
                Bulk Assign
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div v-if="instances.length === 0" class="text-center py-8">
            <p class="text-gray-400">No instances found.</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table">
              <thead class="table-header">
                <tr>
                  <th>Name</th>
                  <th>Workshop</th>
                  <th>Status</th>
                  <th>Power State</th>
                  <th>Team</th>
                  <th>User</th>
                  <th>IP Addresses</th>
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
                  <td class="table-cell">{{ instance.workshop_name }}</td>
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
                  <td class="table-cell">{{ instance.team_name || 'Unassigned' }}</td>
                  <td class="table-cell">{{ instance.user_name || 'Unassigned' }}</td>
                  <td class="table-cell">
                    <div v-if="instance.ip_addresses" class="text-xs">
                      <div v-for="ip in parseIpAddresses(instance.ip_addresses)" :key="ip" class="text-gray-300">
                        {{ ip }}
                      </div>
                    </div>
                    <span v-else class="text-gray-500">-</span>
                  </td>
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
                      <button 
                        v-if="isAdmin"
                        class="btn btn-danger text-xs"
                        @click="deleteInstance(instance.id)"
                      >
                        Delete
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

    <!-- Bulk Assign Modal -->
    <BulkAssignModal
      :show="showBulkAssignModal"
      :instances="instances"
      @close="showBulkAssignModal = false"
      @assigned="onBulkAssigned"
      @error="(message) => error = message"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'
import BulkAssignModal from '@/components/BulkAssignModal.vue'

export default {
  name: 'Instances',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    
    const instances = ref([])
    const workshops = ref([])
    const loading = ref(true)
    const error = ref(null)
    const syncing = ref(false)
    const filters = ref({
      workshop: '',
      status: '',
      powerState: ''
    })

    const showBulkAssignModal = ref(false)

    const isAdmin = computed(() => authStore.isAdmin)

    const fetchInstances = async () => {
      try {
        loading.value = true
        error.value = null
        
        const params = {}
        if (filters.value.workshop) params.workshop = filters.value.workshop
        if (filters.value.status) params.status = filters.value.status
        if (filters.value.powerState) params.power_state = filters.value.powerState
        
        const response = await api.get('/instances', { params })
        instances.value = response.data
      } catch (err) {
        console.error('Error fetching instances:', err)
        error.value = err.response?.data?.message || 'Failed to load instances'
      } finally {
        loading.value = false
      }
    }

    const fetchWorkshops = async () => {
      try {
        const response = await api.get('/workshops')
        workshops.value = response.data
      } catch (err) {
        console.error('Error fetching workshops:', err)
      }
    }

    const viewInstance = (id) => {
      router.push(`/instances/${id}`)
    }

    const openConsole = (id) => {
      router.push(`/console/${id}`)
    }

    const refreshInstances = async () => {
      await fetchInstances()
    }

    const bulkAssign = () => {
      showBulkAssignModal.value = true
    }

    const onBulkAssigned = async () => {
      await fetchInstances()
    }

    const syncInstances = async () => {
      try {
        syncing.value = true
        await api.post('/instances/sync')
        await fetchInstances() // Refresh the list after sync
      } catch (err) {
        console.error('Error syncing instances:', err)
        error.value = 'Failed to sync instances from OpenStack'
      } finally {
        syncing.value = false
      }
    }

    const deleteInstance = async (id) => {
      if (!confirm('Are you sure you want to delete this instance? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.delete(`/instances/${id}`)
        await fetchInstances()
      } catch (err) {
        console.error('Error deleting instance:', err)
      }
    }

    const applyFilters = () => {
      fetchInstances()
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
        case 'error':
          return 'bg-red-100 text-red-800'
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

    onMounted(() => {
      fetchInstances()
      fetchWorkshops()
    })

    return {
      instances,
      workshops,
      loading,
      error,
      syncing,
      filters,
      showBulkAssignModal,
      isAdmin,
      viewInstance,
      openConsole,
      refreshInstances,
      bulkAssign,
      onBulkAssigned,
      syncInstances,
      deleteInstance,
      applyFilters,
      canAccessInstance,
      getStatusClass,
      parseIpAddresses
    }
  }
}
</script> 