<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Teams</h1>
        <p class="text-gray-400">Manage teams and their members across workshops</p>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading teams...</span>
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
            <h3 class="text-sm font-medium text-red-400">Error loading teams</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Teams list -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="team in teams" 
          :key="team.id"
          class="card hover:shadow-xl transition-shadow duration-300 cursor-pointer"
          @click="viewTeam(team.id)"
        >
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">{{ team.name }}</h3>
              <span 
                :class="[
                  'status-badge',
                  team.enabled ? 'status-active' : 'status-inactive'
                ]"
              >
                {{ team.enabled ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          
          <div class="card-body">
            <p class="text-gray-400 mb-4">{{ team.description || 'No description' }}</p>
            
            <div class="space-y-2 text-sm">
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
            </div>
          </div>
          
          <div class="card-footer">
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500">
                Created {{ formatDate(team.created_at) }}
              </span>
              <button 
                class="btn btn-primary text-sm"
                @click.stop="viewTeam(team.id)"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && !error && teams.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-400">No teams found</h3>
        <p class="mt-1 text-sm text-gray-500">Teams will appear here when created in workshops.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

export default {
  name: 'Teams',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    
    const teams = ref([])
    const loading = ref(true)
    const error = ref(null)

    const fetchTeams = async () => {
      try {
        loading.value = true
        error.value = null
        
        const response = await api.get('/teams')
        teams.value = response.data
      } catch (err) {
        console.error('Error fetching teams:', err)
        error.value = err.response?.data?.message || 'Failed to load teams'
      } finally {
        loading.value = false
      }
    }

    const viewTeam = (id) => {
      router.push(`/teams/${id}`)
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString()
    }

    onMounted(() => {
      fetchTeams()
    })

    return {
      teams,
      loading,
      error,
      viewTeam,
      formatDate
    }
  }
}
</script> 