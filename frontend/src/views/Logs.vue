<template>
  <div class="min-h-screen bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Filters -->
      <div class="mb-6 flex flex-wrap gap-4">
        <div class="flex-1 min-w-64">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Filter by Type
          </label>
          <select
            v-model="selectedType"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="vm_action">VM Action</option>
            <option value="admin_action">Admin Action</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div class="flex-1 min-w-64">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Filter by User
          </label>
          <select
            v-model="selectedUser"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Users</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.first_name }} {{ user.last_name }}
            </option>
          </select>
        </div>

        <div class="flex items-end">
          <button
            @click="refreshLogs"
            :disabled="loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
          >
            <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h3 class="text-lg font-medium text-white">Activity Logs</h3>
          <button
            @click="cleanupLogs"
            :disabled="cleanupLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
          >
            <svg v-if="cleanupLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span>Cleanup Old Logs</span>
          </button>
        </div>
        
        <div class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Type</th>
                <th>Action</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="log in filteredLogs" :key="log.id" class="table-row">
                <td class="table-cell">
                  <div class="text-sm">
                    <div class="text-gray-300">{{ formatDate(log.timestamp) }}</div>
                    <div class="text-gray-500 text-xs">{{ formatTime(log.timestamp) }}</div>
                  </div>
                </td>
                <td class="table-cell">
                  <div class="flex items-center">
                    <div class="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center mr-2">
                      <span class="text-white text-xs font-medium">
                        {{ getUserInitials(log.user) }}
                      </span>
                    </div>
                    <span class="text-gray-300">{{ log.user }}</span>
                  </div>
                </td>
                <td class="table-cell">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="getTypeColor(log.type)">
                    {{ log.type }}
                  </span>
                </td>
                <td class="table-cell text-gray-300">{{ log.action }}</td>
                <td class="table-cell text-gray-400 font-mono text-sm">{{ log.ip_address }}</td>
                <td class="table-cell">
                  <div class="text-gray-400 text-sm max-w-xs truncate" :title="log.details">
                    {{ log.details }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && filteredLogs.length === 0" class="text-center py-12">
          <div class="text-gray-400 text-lg mb-4">No logs found</div>
          <p class="text-gray-500">Try adjusting your filters or refreshing the logs.</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12">
          <div class="spinner w-8 h-8 mx-auto mb-4"></div>
          <p class="text-gray-400">Loading logs...</p>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && filteredLogs.length > 0" class="mt-6 flex items-center justify-between">
        <div class="text-sm text-gray-400">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalLogs) }} of {{ totalLogs }} logs
        </div>
        <div class="flex space-x-2">
          <button
            @click="previousPage"
            :disabled="currentPage === 1"
            class="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage >= totalPages"
            class="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'

export default {
  name: 'Logs',
  setup() {
    const loading = ref(false)
    const cleanupLoading = ref(false)
    const error = ref(null)
    const logs = ref([])
    const users = ref([])
    const selectedType = ref('')
    const selectedUser = ref('')
    const currentPage = ref(1)
    const pageSize = ref(50)
    const totalLogs = ref(0)

    const filteredLogs = computed(() => {
      let filtered = logs.value

      if (selectedType.value) {
        filtered = filtered.filter(log => log.type === selectedType.value)
      }

      if (selectedUser.value) {
        const selectedUserName = users.value.find(u => u.id === selectedUser.value)
        if (selectedUserName) {
          const fullName = `${selectedUserName.first_name} ${selectedUserName.last_name}`
          filtered = filtered.filter(log => log.user === fullName)
        }
      }

      return filtered
    })

    const totalPages = computed(() => Math.ceil(totalLogs.value / pageSize.value))

    const getTypeColor = (type) => {
      switch (type) {
        case 'login':
          return 'bg-green-100 text-green-800'
        case 'logout':
          return 'bg-yellow-100 text-yellow-800'
        case 'vm_action':
          return 'bg-blue-100 text-blue-800'
        case 'admin_action':
          return 'bg-purple-100 text-purple-800'
        case 'error':
          return 'bg-red-100 text-red-800'
        default:
          return 'bg-gray-100 text-gray-800'
      }
    }

    const getUserInitials = (userName) => {
      if (!userName) return 'U'
      const names = userName.split(' ')
      return `${names[0]?.charAt(0) || ''}${names[1]?.charAt(0) || ''}`
    }

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString()
    }

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString()
    }

    const loadLogs = async () => {
      loading.value = true
      error.value = null
      
      try {
        const [logsResponse, usersResponse] = await Promise.all([
          api.admin.getLogs({
            page: currentPage.value,
            limit: pageSize.value,
            type: selectedType.value || undefined,
            user_id: selectedUser.value || undefined
          }),
          api.users.getAll()
        ])
        
        logs.value = logsResponse.data.logs || logsResponse.data
        totalLogs.value = logsResponse.data.total || logsResponse.data.length
        users.value = usersResponse.data
      } catch (err) {
        console.error('Error loading logs:', err)
        error.value = 'Failed to load logs. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const refreshLogs = () => {
      loadLogs()
    }

    const previousPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--
        loadLogs()
      }
    }

    const nextPage = () => {
      if (currentPage.value < totalPages.value) {
        currentPage.value++
        loadLogs()
      }
    }

    const cleanupLogs = async () => {
      if (!confirm('Are you sure you want to delete logs older than 7 days? This action cannot be undone.')) {
        return
      }
      
      cleanupLoading.value = true
      error.value = null
      
      try {
        const response = await api.admin.cleanupLogs(7)
        alert(`Successfully cleaned up logs: ${response.data.message}. Deleted ${response.data.deleted_count} log entries.`)
        // Refresh logs after cleanup
        loadLogs()
      } catch (err) {
        console.error('Error cleaning up logs:', err)
        error.value = 'Failed to cleanup logs. Please try again.'
        alert('Failed to cleanup logs. Please try again.')
      } finally {
        cleanupLoading.value = false
      }
    }

    onMounted(() => {
      loadLogs()
    })

    return {
      loading,
      cleanupLoading,
      error,
      logs,
      users,
      selectedType,
      selectedUser,
      currentPage,
      pageSize,
      totalLogs,
      filteredLogs,
      totalPages,
      getTypeColor,
      getUserInitials,
      formatDate,
      formatTime,
      loadLogs,
      refreshLogs,
      previousPage,
      nextPage,
      cleanupLogs
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style> 