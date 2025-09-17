<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Ingest VMs from Provider</h3>
      </div>
      <div class="p-6">
        <!-- Step 1: Select Competition or Team -->
        <div class="mb-8">
          <h4 class="text-lg font-medium text-white mb-4">Step 1: Select Competition or Team</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Select Competition</label>
              <select v-model="ingestForm.competitionId" @change="onCompetitionChange" class="form-input">
                <option value="">Choose a competition</option>
                <option v-for="competition in competitions" :key="competition.id" :value="competition.id">
                  {{ competition.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="form-label">Select Team</label>
              <select v-model="ingestForm.teamId" @change="onTeamChange" class="form-input">
                <option value="">Choose a team</option>
                <option v-for="team in teams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 2: VM Assignment (only show if competition is selected or team is selected) -->
        <div v-if="ingestForm.competitionId || ingestForm.teamId" class="mb-8">
          <h4 class="text-lg font-medium text-white mb-4">Step 2: Assign VMs to Teams</h4>
          
          <!-- Show current competition info -->
          <div v-if="currentCompetition" class="mb-4 p-3 bg-gray-700 rounded-lg">
            <p class="text-sm text-gray-300">
              <span class="font-medium">Competition:</span> {{ currentCompetition.name }}
              <span v-if="ingestForm.teamId" class="text-gray-500 ml-2">(auto-selected from team)</span>
            </p>
          </div>
          
          <!-- Fetch VMs Button -->
          <div class="mb-6">
            <button 
              @click="fetchVMs"
              :disabled="fetchingVMs"
              class="btn btn-secondary"
            >
              <div v-if="fetchingVMs" class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching VMs...
              </div>
              <span v-else>Fetch VMs from Provider</span>
            </button>
          </div>

          <!-- VMs Assignment Table -->
          <div v-if="fetchedVMs.length > 0" class="bg-gray-700 rounded-lg p-4">
            <h5 class="text-md font-medium text-white mb-4">Assign VMs to Teams</h5>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-600">
                    <th class="text-left py-2 px-2 text-gray-300">VM Name</th>
                    <th class="text-left py-2 px-2 text-gray-300">Status</th>
                    <th class="text-left py-2 px-2 text-gray-300">Assign to Team</th>
                    <th class="text-left py-2 px-2 text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vm in fetchedVMs" :key="vm.id" class="border-b border-gray-600">
                    <td class="py-2 px-2">{{ vm.name }}</td>
                    <td class="py-2 px-2">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                            :class="getStatusColor(vm.status)">
                        {{ vm.status }}
                      </span>
                    </td>
                    <td class="py-2 px-2">
                      <select v-model="vm.assignedTeamId" class="form-input text-sm">
                        <option value="">No team assigned</option>
                        <option v-for="team in availableTeams" :key="team.id" :value="team.id">
                          {{ team.name }}
                        </option>
                      </select>
                    </td>
                    <td class="py-2 px-2">
                      <button 
                        @click="assignVM(vm)"
                        :disabled="!vm.assignedTeamId"
                        class="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Bulk Actions -->
            <div class="mt-4 flex justify-between items-center">
              <div class="flex space-x-2">
                <button 
                  @click="assignAllVMs"
                  :disabled="!hasVMsWithTeams"
                  class="btn btn-primary text-sm whitespace-nowrap"
                >
                  Assign All VMs
                </button>
                <select v-model="bulkAssignTeamId" class="form-input text-sm">
                  <option value="">Select team for bulk assignment</option>
                  <option v-for="team in availableTeams" :key="team.id" :value="team.id">
                    {{ team.name }}
                  </option>
                </select>
              </div>
              <div class="text-sm text-gray-400">
                {{ assignedVMsCount }} of {{ fetchedVMs.length }} VMs assigned
              </div>
            </div>
          </div>

          <!-- No VMs Found -->
          <div v-else-if="!fetchingVMs && fetchedVMs.length === 0" class="text-center py-8">
            <p class="text-gray-400">No VMs found for this competition.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Assignment Progress Modal -->
    <AssignmentProgressModal
      :show="showProgressModal"
      :is-loading="assignmentLoading"
      :completed="assignmentProgress.completed"
      :total="assignmentProgress.total"
      :current-status="assignmentProgress.currentStatus"
      :current-team="assignmentProgress.currentTeam"
      :success-message="assignmentProgress.successMessage"
      :error-message="assignmentProgress.errorMessage"
      @close="closeProgressModal"
      @cancel="cancelAssignment"
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
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/services/api'
import Toast from '@/components/Toast.vue'
import AssignmentProgressModal from '@/components/AssignmentProgressModal.vue'

export default {
  name: 'IngestVMs',
  components: {
    Toast,
    AssignmentProgressModal
  },
  setup() {
    const competitions = ref([])
    const teams = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // VM Ingest State
    const fetchingVMs = ref(false)
    const fetchedVMs = ref([])
    const bulkAssignTeamId = ref('')
    
    // Assignment Progress State
    const showProgressModal = ref(false)
    const assignmentLoading = ref(false)
    const assignmentCancelled = ref(false)
    const assignmentProgress = ref({
      completed: 0,
      total: 0,
      currentStatus: '',
      currentTeam: '',
      successMessage: '',
      errorMessage: ''
    })
    
    // Forms
    const ingestForm = ref({
      teamId: '',
      competitionId: ''
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
        
        const [competitionsResponse, teamsResponse] = await Promise.all([
          api.workshops.getAll(),
          api.teams.getAll()
        ])
        
        competitions.value = competitionsResponse.data
        teams.value = teamsResponse.data
      } catch (err) {
        console.error('Error loading ingest data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Computed property for available teams (filtered by competition)
    const availableTeams = computed(() => {
      if (!ingestForm.value.competitionId) return []
      return teams.value.filter(team => team.workshop_id === ingestForm.value.competitionId)
    })

    // Computed property for assigned VMs count
    const assignedVMsCount = computed(() => {
      return fetchedVMs.value.filter(vm => vm.assignedTeamId).length
    })

    // Computed property for VMs with teams assigned
    const hasVMsWithTeams = computed(() => {
      return fetchedVMs.value.some(vm => vm.assignedTeamId)
    })

    // Computed property for current competition
    const currentCompetition = computed(() => {
      let competitionId = ingestForm.value.competitionId
      
      // If no competition is selected but a team is selected, get competition from team
      if (!competitionId && ingestForm.value.teamId) {
        const selectedTeam = teams.value.find(t => t.id === ingestForm.value.teamId)
        if (selectedTeam && selectedTeam.workshop_id) {
          competitionId = selectedTeam.workshop_id
        }
      }
      
      if (!competitionId) return null
      
      return competitions.value.find(c => c.id === competitionId)
    })

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'running':
        case 'active':
          return 'bg-green-500'
        case 'stopped':
        case 'shutoff':
          return 'bg-red-500'
        case 'rebooting':
        case 'building':
          return 'bg-yellow-500'
        default:
          return 'bg-gray-500'
      }
    }

    const onCompetitionChange = () => {
      // Reset fetched VMs when competition changes
      fetchedVMs.value = []
      // Clear team selection when competition changes
      ingestForm.value.teamId = ''
    }

    const onTeamChange = () => {
      // Reset fetched VMs when team changes
      fetchedVMs.value = []
      
      // If a team is selected, automatically set the competition
      if (ingestForm.value.teamId) {
        const selectedTeam = teams.value.find(t => t.id === ingestForm.value.teamId)
        if (selectedTeam && selectedTeam.workshop_id) {
          ingestForm.value.competitionId = selectedTeam.workshop_id
        }
      } else {
        // If no team is selected, clear the competition
        ingestForm.value.competitionId = ''
      }
    }

    // Watch for bulk team selection to update all VM dropdowns
    watch(bulkAssignTeamId, (newTeamId) => {
      if (newTeamId && fetchedVMs.value.length > 0) {
        // Update all VM dropdowns to the selected team
        fetchedVMs.value.forEach(vm => {
          vm.assignedTeamId = newTeamId
        })
      }
    })

    const fetchVMs = async () => {
      let competitionId = ingestForm.value.competitionId
      
      // If no competition is selected but a team is selected, get competition from team
      if (!competitionId && ingestForm.value.teamId) {
        const selectedTeam = teams.value.find(t => t.id === ingestForm.value.teamId)
        if (selectedTeam && selectedTeam.workshop_id) {
          competitionId = selectedTeam.workshop_id
        }
      }
      
      if (!competitionId) {
        showToast('Please select a competition or team', 'error')
        return
      }

      fetchingVMs.value = true
      try {
        // Get the competition to find its project name and provider
        const competition = competitions.value.find(c => c.id === competitionId)
        if (!competition) {
          showToast('Competition not found', 'error')
          return
        }

        // Fetch VMs from the provider for this specific competition
        const response = await api.providers.getInstances(competition.provider_id, {
          project_name: competition.openstack_project_name
        })

        if (response.data.success) {
          // Transform the response to include assignment fields
          fetchedVMs.value = response.data.instances.map(vm => ({
            ...vm,
            assignedTeamId: ingestForm.value.teamId || '', // Pre-assign to selected team if any
            isAssigned: false
          }))

          showToast(`Found ${fetchedVMs.value.length} VMs`, 'success')
        } else {
          showToast('Failed to fetch VMs from provider', 'error')
        }
      } catch (err) {
        console.error('Error fetching VMs:', err)
        const errorMessage = err.response?.data?.error || 'Failed to fetch VMs from provider'
        showToast(errorMessage, 'error')
      } finally {
        fetchingVMs.value = false
      }
    }

    const assignVM = async (vm) => {
      if (!vm.assignedTeamId) {
        showToast('Please select a team for this VM', 'error')
        return
      }

      try {
        // Get the competition ID (either directly selected or from team)
        let competitionId = ingestForm.value.competitionId
        if (!competitionId && ingestForm.value.teamId) {
          const selectedTeam = teams.value.find(t => t.id === ingestForm.value.teamId)
          if (selectedTeam && selectedTeam.workshop_id) {
            competitionId = selectedTeam.workshop_id
          }
        }
        
        const competition = competitions.value.find(c => c.id === competitionId)
        if (!competition) {
          showToast('Competition not found', 'error')
          return
        }

        // Ingest this specific VM and assign it to the selected team
        const response = await api.providers.ingestVMs(competition.provider_id, {
          team_id: vm.assignedTeamId,
          instance_ids: [vm.id],
          project_name: competition.openstack_project_name
        })

        vm.isAssigned = true
        showToast(`VM "${vm.name}" assigned to team successfully`, 'success')
        
        // Refresh data to update the main VM list
        await fetchData()
      } catch (err) {
        console.error('Error assigning VM:', err)
        const errorMessage = err.response?.data?.error || 'Failed to assign VM to team'
        showToast(errorMessage, 'error')
      }
    }

    const assignAllVMs = async () => {
      // Get VMs that have teams assigned in their dropdowns
      const vmsWithTeams = fetchedVMs.value.filter(vm => vm.assignedTeamId)
      
      if (vmsWithTeams.length === 0) {
        showToast('Please select teams for VMs using the dropdowns', 'error')
        return
      }

      // Initialize progress modal
      assignmentCancelled.value = false
      assignmentLoading.value = true
      showProgressModal.value = true
      assignmentProgress.value = {
        completed: 0,
        total: vmsWithTeams.length,
        currentStatus: 'Starting assignment...',
        currentTeam: '',
        successMessage: '',
        errorMessage: ''
      }

      try {
        // Get the competition ID (either directly selected or from team)
        let competitionId = ingestForm.value.competitionId
        if (!competitionId && ingestForm.value.teamId) {
          const selectedTeam = teams.value.find(t => t.id === ingestForm.value.teamId)
          if (selectedTeam && selectedTeam.workshop_id) {
            competitionId = selectedTeam.workshop_id
          }
        }
        
        const competition = competitions.value.find(c => c.id === competitionId)
        if (!competition) {
          assignmentProgress.value.errorMessage = 'Competition not found'
          assignmentLoading.value = false
          return
        }

        // Group VMs by team for batch processing
        const vmsByTeam = {}
        vmsWithTeams.forEach(vm => {
          if (!vmsByTeam[vm.assignedTeamId]) {
            vmsByTeam[vm.assignedTeamId] = []
          }
          vmsByTeam[vm.assignedTeamId].push(vm)
        })

        // Process each team's VMs
        let totalAssigned = 0
        const teamEntries = Object.entries(vmsByTeam)
        
        for (let i = 0; i < teamEntries.length; i++) {
          if (assignmentCancelled.value) {
            assignmentProgress.value.currentStatus = 'Assignment cancelled'
            assignmentLoading.value = false
            return
          }

          const [teamId, teamVMs] = teamEntries[i]
          const teamName = availableTeams.value.find(t => t.id === teamId)?.name || 'Unknown Team'
          
          assignmentProgress.value.currentStatus = `Assigning ${teamVMs.length} VMs to ${teamName}...`
          assignmentProgress.value.currentTeam = teamName

          const response = await api.providers.ingestVMs(competition.provider_id, {
            team_id: teamId,
            instance_ids: teamVMs.map(vm => vm.id),
            project_name: competition.openstack_project_name
          })

          // Mark VMs as assigned
          teamVMs.forEach(vm => {
            vm.isAssigned = true
          })
          
          totalAssigned += teamVMs.length
          assignmentProgress.value.completed = totalAssigned
        }

        // Show success
        assignmentProgress.value.currentStatus = 'Assignment completed successfully!'
        assignmentProgress.value.successMessage = `${totalAssigned} VMs assigned successfully`
        assignmentLoading.value = false
        
        // Refresh data to update the main VM list
        await fetchData()
      } catch (err) {
        console.error('Error bulk assigning VMs:', err)
        const errorMessage = err.response?.data?.error || 'Failed to assign VMs to teams'
        assignmentProgress.value.errorMessage = errorMessage
        assignmentProgress.value.currentStatus = 'Assignment failed'
        assignmentLoading.value = false
      }
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

    const closeProgressModal = () => {
      showProgressModal.value = false
      assignmentProgress.value = {
        completed: 0,
        total: 0,
        currentStatus: '',
        currentTeam: '',
        successMessage: '',
        errorMessage: ''
      }
    }

    const cancelAssignment = () => {
      assignmentCancelled.value = true
    }

    onMounted(() => {
      fetchData()
    })

    return {
      competitions,
      teams,
      loading,
      error,
      ingestForm,
      fetchingVMs,
      fetchedVMs,
      bulkAssignTeamId,
      availableTeams,
      assignedVMsCount,
      hasVMsWithTeams,
      currentCompetition,
      showProgressModal,
      assignmentLoading,
      assignmentProgress,
      toast,
      getStatusColor,
      onCompetitionChange,
      onTeamChange,
      fetchVMs,
      assignVM,
      assignAllVMs,
      showToast,
      closeToast,
      closeProgressModal,
      cancelAssignment
    }
  }
}
</script>
