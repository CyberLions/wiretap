<template>
  <div class="min-h-screen bg-gray-900 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Competition Filter (Admin Only) -->
      <div v-if="isAdmin" class="mb-6">
        <div class="max-w-md">
          <label for="competition-filter" class="block text-sm font-medium text-gray-300 mb-2">
            Filter by Competition
          </label>
          <select
            id="competition-filter"
            v-model="selectedCompetition"
            @change="filterInstances"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Competitions</option>
            <option
              v-for="competition in competitions"
              :key="competition.id"
              :value="competition.id"
            >
              {{ competition.name }}
            </option>
          </select>
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
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            
            <!-- Admin Info -->
            <div v-if="isAdmin" class="flex flex-wrap gap-2 mb-3">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {{ instance.team?.name || `Team ${instance.team?.number}` || 'No Team' }}
              </span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {{ instance.workshop?.name || 'Unknown' }}
              </span>
            </div>

            <!-- IP Addresses -->
            <p class="text-sm text-gray-400">
              {{ instance.ip_addresses?.join(', ') || 'No IP addresses' }}
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
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Console
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !error && filteredInstances.length === 0" class="text-center py-12">
        <div class="text-gray-400 text-lg mb-4">
          {{ selectedCompetition ? 'No instances found for this competition' : 'No instances available' }}
        </div>
        <p class="text-gray-500">
          {{ selectedCompetition ? 'Try selecting a different competition or contact an administrator.' : 'Contact an administrator to get access to instances.' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'

export default {
  name: 'Dashboard',
  setup() {
    const { user, isAdmin } = useAuth()
    
    const loading = ref(false)
    const error = ref(null)
    const instances = ref([])
    const competitions = ref([])
    const selectedCompetition = ref('')

    const filteredInstances = computed(() => {
      if (!selectedCompetition.value) {
        return instances.value
      }
      return instances.value.filter(instance => 
        instance.workshop?.id === selectedCompetition.value
      )
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
      } catch (err) {
        console.error('Error loading instances:', err)
        error.value = 'Failed to load instances. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const filterInstances = () => {
      // Filtering is handled by computed property
    }

    onMounted(() => {
      loadInstances()
    })

    return {
      loading,
      error,
      instances,
      competitions,
      selectedCompetition,
      isAdmin,
      filteredInstances,
      getStatusColor,
      loadInstances,
      filterInstances
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style> 