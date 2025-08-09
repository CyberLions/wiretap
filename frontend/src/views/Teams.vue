<template>
  <div class="space-y-6">
    <!-- Filters -->
    <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 class="text-lg font-medium text-white mb-4">Filters</h3>
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Competition Dropdown -->
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-300 mb-2">Competition</label>
          <select 
            v-model="teamFilters.selectedCompetition" 
            class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Competitions</option>
            <option v-for="competition in competitions" :key="competition.id" :value="competition.id">
              {{ competition.name }}
            </option>
          </select>
        </div>

        <!-- Search Input -->
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-300 mb-2">Search</label>
          <input 
            v-model="teamFilters.searchQuery" 
            type="text" 
            placeholder="Search teams..."
            class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Team Management</h3>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>Team Name</th>
                <th>Number</th>
                <th>Competition</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="team in filteredTeams" :key="team.id" class="table-row">
                <td class="table-cell">{{ team.name }}</td>
                <td class="table-cell">{{ team.team_number }}</td>
                <td class="table-cell">{{ team.workshop?.name || 'Unknown' }}</td>
                <td class="table-cell">{{ team.member_count || 0 }} members</td>
                <td class="table-cell">
                  <div class="flex space-x-2">
                    <button @click="manageTeamMembers(team.id)" class="text-green-400 hover:text-green-300">Members</button>
                    <button @click="editTeam(team.id)" class="text-blue-400 hover:text-blue-300">Edit</button>
                    <button @click="deleteTeam(team.id)" class="text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add Team Modal -->
    <AddTeamModal
      :show="showAddTeamModal"
      :competitions="competitions"
      @close="closeAddTeamModal"
      @created="onTeamCreated"
      @error="(message) => showToast(message, 'error')"
    />

    <!-- Edit Team Modal -->
    <EditTeamModal
      :show="showEditTeamModal"
      :team="selectedTeam"
      :competitions="competitions"
      @close="closeEditTeamModal"
      @updated="onTeamUpdated"
      @error="(message) => showToast(message, 'error')"
    />

    <!-- Team Members Modal -->
    <TeamMembersModal
      :show="showTeamMembersModal"
      :team="selectedTeam"
      :allUsers="users"
      @close="closeTeamMembersModal"
      @updated="onTeamMembersUpdated"
      @error="(message) => showToast(message, 'error')"
    />

    <!-- Toast Notification -->
    <Toast
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @close="closeToast"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'
import AddTeamModal from '@/components/AddTeamModal.vue'
import EditTeamModal from '@/components/EditTeamModal.vue'
import TeamMembersModal from '@/components/TeamMembersModal.vue'
import Toast from '@/components/Toast.vue'

export default {
  name: 'Teams',
  components: {
    AddTeamModal,
    EditTeamModal,
    TeamMembersModal,
    Toast
  },
  setup(_, { expose }) {
    const teams = ref([])
    const competitions = ref([])
    const users = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // Modal states
    const showAddTeamModal = ref(false)
    const showEditTeamModal = ref(false)
    const showTeamMembersModal = ref(false)
    const selectedTeam = ref(null)
    
    // Filters
    const teamFilters = ref({
      selectedCompetition: '',
      searchQuery: ''
    })
    
    // Toast notifications
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    })

    const fetchData = async () => {
      try {
        loading.value = true
        error.value = null
        
        const [teamsResponse, competitionsResponse, usersResponse] = await Promise.all([
          api.teams.getAll(),
          api.workshops.getAll(),
          api.users.getAll()
        ])
        
        teams.value = teamsResponse.data
        competitions.value = competitionsResponse.data
        users.value = usersResponse.data
      } catch (err) {
        console.error('Error loading teams data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Computed property for filtered teams
    const filteredTeams = computed(() => {
      let filtered = teams.value

      // Filter by competition
      if (teamFilters.value.selectedCompetition) {
        filtered = filtered.filter(team => team.workshop_id === teamFilters.value.selectedCompetition)
      }

      // Filter by search query
      if (teamFilters.value.searchQuery) {
        const query = teamFilters.value.searchQuery.toLowerCase()
        filtered = filtered.filter(team => 
          team.name.toLowerCase().includes(query) ||
          (team.workshop?.name && team.workshop.name.toLowerCase().includes(query))
        )
      }

      return filtered
    })

    const editTeam = (teamId) => {
      const team = teams.value.find(t => t.id === teamId)
      if (team) {
        selectedTeam.value = team
        showEditTeamModal.value = true
      }
    }

    const deleteTeam = async (teamId) => {
      if (!confirm('Are you sure you want to delete this team? This will also delete any associated instances and generated users (@workshop.local) in this team. This action cannot be undone.')) {
        return
      }
      
      try {
        const response = await api.teams.delete(teamId)
        await fetchData()
        showToast(response.data.message || 'Team deleted successfully', 'success')
      } catch (err) {
        console.error('Error deleting team:', err)
        const errorMessage = err.response?.data?.error || 'Failed to delete team'
        showToast(errorMessage, 'error')
      }
    }

    const manageTeamMembers = (teamId) => {
      const team = teams.value.find(t => t.id === teamId)
      if (team) {
        selectedTeam.value = team
        showTeamMembersModal.value = true
      }
    }

    const closeAddTeamModal = () => {
      showAddTeamModal.value = false
    }

    // Expose method to open the create modal from parent
    const openAddTeam = () => {
      showAddTeamModal.value = true
    }

    const closeEditTeamModal = () => {
      showEditTeamModal.value = false
      selectedTeam.value = null
    }

    const closeTeamMembersModal = () => {
      showTeamMembersModal.value = false
    }

    const onTeamCreated = () => {
      fetchData()
      showToast('Team created successfully', 'success')
    }

    const onTeamUpdated = () => {
      fetchData()
      showToast('Team updated successfully', 'success')
    }

    const onTeamMembersUpdated = () => {
      showToast('Team members updated successfully', 'success')
    }

    const showToast = (message, type = 'success') => {
      toast.value = {
        show: true,
        message,
        type
      }
      setTimeout(() => {
        toast.value.show = false
      }, 3000)
    }

    const closeToast = () => {
      toast.value.show = false
    }

    // Expose method to open the create modal from parent
    expose({ openAddTeam })

    onMounted(() => {
      fetchData()
    })

    return {
      teams,
      competitions,
      users,
      loading,
      error,
      teamFilters,
      filteredTeams,
      showAddTeamModal,
      showEditTeamModal,
      showTeamMembersModal,
      selectedTeam,
      toast,
      editTeam,
      deleteTeam,
      manageTeamMembers,
      closeAddTeamModal,
      openAddTeam,
      closeEditTeamModal,
      closeTeamMembersModal,
      onTeamCreated,
      onTeamUpdated,
      onTeamMembersUpdated,
      showToast,
      closeToast
    }
  }
}
</script> 