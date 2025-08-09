<template>
  <div class="min-h-screen bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Filters -->
      <div class="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 class="text-lg font-medium text-white mb-4">Filters</h3>
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Competition Dropdown -->
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-300 mb-2">Competition</label>
            <select 
              v-model="selectedCompetition" 
              class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Competitions</option>
              <option v-for="competition in competitions" :key="competition.id" :value="competition.id">
                {{ competition.name }}
              </option>
            </select>
          </div>

          <!-- Team Dropdown -->
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-300 mb-2">Team</label>
            <select 
              v-model="selectedTeam" 
              class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Teams</option>
              <option v-for="team in availableTeams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>

          <!-- Search Input -->
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search instances..."
              class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Clear Filters Button -->
          <div class="flex items-end">
            <button
              @click="clearFilters"
              class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="i in 8"
          :key="i"
          class="bg-gray-800 rounded-lg p-6 animate-pulse"
        >
          <div class="h-4 bg-gray-700 rounded mb-4"></div>
          <div class="h-3 bg-gray-700 rounded mb-2"></div>
          <div class="h-3 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <div class="text-red-400 text-lg mb-4">{{ error }}</div>
        <button
          @click="loadInstances"
          class="btn btn-primary"
        >
          Try Again
        </button>
      </div>

      <!-- VM Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="instance in filteredInstances"
          :key="instance.id"
          class="bg-gray-800 rounded-lg shadow-lg border border-gray-700 hover:border-gray-600 transition-colors duration-200"
        >
          <!-- VM Card Header -->
          <div class="p-6 border-b border-gray-700">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold text-white truncate">
                {{ instance.name }}
              </h3>
              <div v-if="instance.locked" class="text-yellow-400">
                <LockClosedIcon class="w-5 h-5" />
              </div>
            </div>
            
            <!-- Admin Info -->
            <div v-if="isAdmin" class="flex flex-wrap gap-2 mb-3">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {{ instance.team_name || 'No Team' }}
              </span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {{ instance.workshop_name || 'Unknown' }}
              </span>
            </div>

            <!-- IP Addresses -->
            <p class="text-sm text-gray-400">
              {{ parseIpAddresses(instance.ip_addresses).join(', ') || 'No IP addresses' }}
            </p>
          </div>

          <!-- VM Card Actions -->
          <div class="p-4">
            <div class="flex items-center justify-between">
              <!-- Status Indicator -->
              <div class="flex items-center space-x-2">
                <div
                  class="w-3 h-3 rounded-full"
                  :class="getStatusColor(instance.status)"
                ></div>
                <span class="text-sm text-gray-300 capitalize">
                  {{ instance.status || 'unknown' }}
                </span>
              </div>

              <!-- Console Button -->
              <router-link
                :to="`/console/${instance.id}`"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
              >
                <ComputerDesktopIcon class="w-4 h-4 mr-2" />
                Console
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !error && filteredInstances.length === 0" class="text-center py-12">
        <div class="text-gray-400 text-lg mb-4">
          {{ (selectedCompetition || selectedTeam || searchQuery) ? 'No instances found with the current filters' : 'No instances available' }}
        </div>
        <p class="text-gray-500">
          {{ (selectedCompetition || selectedTeam || searchQuery) ? 'Try adjusting your filters or contact our tech team.' : 'Contact our tech team to get access to instances.' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'
import { LockClosedIcon, ComputerDesktopIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'Dashboard',
  components: {
    LockClosedIcon,
    ComputerDesktopIcon
  },
  setup() {
    const { user, isAdmin } = useAuth()
    
    const loading = ref(false)
    const error = ref(null)
    const instances = ref([])
    const competitions = ref([])
    const selectedCompetition = ref('')
    const selectedTeam = ref('')
    const searchQuery = ref('')

    const filteredInstances = computed(() => {
      let filtered = instances.value

      // Filter by competition
      if (selectedCompetition.value) {
        filtered = filtered.filter(instance => instance.workshop_id === selectedCompetition.value)
      }

      // Filter by team
      if (selectedTeam.value) {
        filtered = filtered.filter(instance => instance.team_id === selectedTeam.value)
      }

      // Filter by search query
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(instance => 
          instance.name.toLowerCase().includes(query) ||
          (instance.workshop_name && instance.workshop_name.toLowerCase().includes(query)) ||
          (instance.team_name && instance.team_name.toLowerCase().includes(query))
        )
      }

      return filtered
    })

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'running':
        case 'powered_on':
        case 'active':
          return 'bg-green-500'
        case 'stopped':
        case 'powered_off':
        case 'shutoff':
          return 'bg-red-500'
        case 'starting':
        case 'stopping':
        case 'rebooting':
        case 'building':
          return 'bg-yellow-500'
        default:
          return 'bg-gray-500'
      }
    }

    // Computed property for available teams
    const availableTeams = computed(() => {
      const allTeams = []
      instances.value.forEach(instance => {
        if (instance.team_id && instance.team_name) {
          const existingTeam = allTeams.find(team => team.id === instance.team_id)
          if (!existingTeam) {
            allTeams.push({
              id: instance.team_id,
              name: instance.team_name
            })
          }
        }
      })
      return allTeams.sort((a, b) => a.name.localeCompare(b.name))
    })

    const FILTERS_STORAGE_KEY = 'dashboard_filters_v1'

    const loadSavedFilters = () => {
      try {
        const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }

    const persistFilters = () => {
      const payload = {
        competition: selectedCompetition.value || '',
        team: selectedTeam.value || '',
        search: searchQuery.value || ''
      }
      try { 
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload))
      } catch (err) { 
        console.error('Failed to save filters:', err)
      }
    }

    const applySavedFiltersIfValid = () => {
      const saved = loadSavedFilters()
      if (!saved) return

      let didChange = false

      // Validate competition
      if (saved.competition) {
        const compId = saved.competition
        const compIds = new Set(competitions.value.map(c => c.id))
        if (compIds.has(compId)) {
          selectedCompetition.value = compId
        } else {
          selectedCompetition.value = ''
          didChange = true
        }
      }

      // Validate team - wait for availableTeams to be computed
      if (saved.team && availableTeams.value.length > 0) {
        const teamId = saved.team
        const teamIds = new Set(availableTeams.value.map(t => t.id))
        if (teamIds.has(teamId)) {
          selectedTeam.value = teamId
        } else {
          selectedTeam.value = ''
          didChange = true
        }
      }

      // Search is always valid
      if (typeof saved.search === 'string') {
        searchQuery.value = saved.search
      }

      if (didChange) {
        persistFilters()
      }
    }

    const loadInstances = async () => {
      loading.value = true
      error.value = null
      
      try {
        const [instancesResponse, competitionsResponse] = await Promise.all([
          api.instances.getAll(),
          api.workshops.getAll()
        ])
        
        instances.value = instancesResponse.data
        competitions.value = competitionsResponse.data
        
        // Use nextTick to ensure computed properties are updated before applying filters
        await nextTick()
        applySavedFiltersIfValid()
      } catch (err) {
        console.error('Error loading instances:', err)
        error.value = 'Failed to load instances. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Also apply filters when data changes (e.g., after refresh)
    const refreshData = async () => {
      await loadInstances()
    }

    // Clear all filters
    const clearFilters = () => {
      selectedCompetition.value = ''
      selectedTeam.value = ''
      searchQuery.value = ''
      persistFilters()
    }

    const filterInstances = () => {
      // Filtering is handled by computed property
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
      // Persist on any change
      watch([selectedCompetition, selectedTeam, searchQuery], () => {
        persistFilters()
      })

      // Load data first, then apply saved filters
      loadInstances()
    })

    return {
      loading,
      error,
      instances,
      competitions,
      selectedCompetition,
      selectedTeam,
      searchQuery,
      availableTeams,
      isAdmin,
      filteredInstances,
      getStatusColor,
      loadInstances,
      refreshData,
      clearFilters,
      filterInstances,
      parseIpAddresses
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style> 