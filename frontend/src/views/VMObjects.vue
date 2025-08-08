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
            v-model="vmFilters.selectedCompetition" 
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
            v-model="vmFilters.selectedTeam" 
            class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Teams</option>
            <option v-for="team in availableVMTeams" :key="team.id" :value="team.id">
              {{ team.name }}
            </option>
          </select>
        </div>

        <!-- Search Input -->
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-300 mb-2">Search</label>
          <input 
            v-model="vmFilters.searchQuery" 
            type="text" 
            placeholder="Search VMs..."
            class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">VM Object Management</h3>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            v-for="vm in filteredVMObjects"
            :key="vm.id"
            class="bg-gray-700 rounded-lg p-4 border border-gray-600 relative"
            :class="{ 'border-yellow-500': vm.locked }"
          >
            <!-- Lock indicator -->
            <div v-if="vm.locked" class="absolute top-2 right-2">
              <div class="bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold">
                LOCKED
              </div>
            </div>
            
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-lg font-medium text-white">{{ vm.name }}</h4>
              <div
                class="w-3 h-3 rounded-full"
                :class="getStatusColor(vm.status)"
              ></div>
            </div>
            <p class="text-gray-400 text-sm mb-2">{{ parseIpAddresses(vm.ip_addresses).join(', ') || 'No IP addresses' }}</p>
            <p class="text-gray-400 text-sm mb-4">Team: {{ vm.team_name || 'No Team' }}</p>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-300">{{ vm.status }}</span>
              <div class="flex space-x-2">
                <button @click="editVM(vm.id)" class="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                <button 
                  v-if="!vm.locked"
                  @click="lockoutVM(vm.id)" 
                  class="text-yellow-400 hover:text-yellow-300 text-sm"
                >
                  Lock
                </button>
                <button 
                  v-else
                  @click="unlockVM(vm.id)" 
                  class="text-green-400 hover:text-green-300 text-sm"
                >
                  Unlock
                </button>
                <button @click="deleteVM(vm.id)" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-if="!loading && !error && filteredVMObjects.length === 0" class="text-center py-12">
          <div class="text-gray-400 text-lg mb-4">
            {{ (vmFilters.selectedCompetition || vmFilters.selectedTeam || vmFilters.searchQuery) ? 'No VMs found with the current filters' : 'No VMs available' }}
          </div>
          <p class="text-gray-500">
            {{ (vmFilters.selectedCompetition || vmFilters.selectedTeam || vmFilters.searchQuery) ? 'Try adjusting your filters.' : 'No VMs have been created yet.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Edit VM Modal -->
    <EditVMModal
      :show="showEditVMModal"
      :vm="selectedVM"
      @close="closeEditVMModal"
      @updated="onVMUpdated"
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
import EditVMModal from '@/components/EditVMModal.vue'
import Toast from '@/components/Toast.vue'

export default {
  name: 'VMObjects',
  components: {
    EditVMModal,
    Toast
  },
  setup() {
    const vmObjects = ref([])
    const competitions = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // Modal states
    const showEditVMModal = ref(false)
    const selectedVM = ref(null)
    
    // Filters
    const vmFilters = ref({
      selectedCompetition: '',
      selectedTeam: '',
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
        
        const [vmObjectsResponse, competitionsResponse] = await Promise.all([
          api.instances.getAll(),
          api.workshops.getAll()
        ])
        
        vmObjects.value = vmObjectsResponse.data
        competitions.value = competitionsResponse.data
      } catch (err) {
        console.error('Error loading VM objects data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Computed property for available VM teams
    const availableVMTeams = computed(() => {
      const allTeams = []
      vmObjects.value.forEach(vm => {
        if (vm.team_id && vm.team_name) {
          const existingTeam = allTeams.find(team => team.id === vm.team_id)
          if (!existingTeam) {
            allTeams.push({
              id: vm.team_id,
              name: vm.team_name
            })
          }
        }
      })
      return allTeams.sort((a, b) => a.name.localeCompare(b.name))
    })

    // Computed property for filtered VM objects
    const filteredVMObjects = computed(() => {
      let filtered = vmObjects.value

      // Filter by competition
      if (vmFilters.value.selectedCompetition) {
        filtered = filtered.filter(vm => vm.workshop_id === vmFilters.value.selectedCompetition)
      }

      // Filter by team
      if (vmFilters.value.selectedTeam) {
        filtered = filtered.filter(vm => vm.team_id === vmFilters.value.selectedTeam)
      }

      // Filter by search query
      if (vmFilters.value.searchQuery) {
        const query = vmFilters.value.searchQuery.toLowerCase()
        filtered = filtered.filter(vm => 
          vm.name.toLowerCase().includes(query) ||
          (vm.workshop_name && vm.workshop_name.toLowerCase().includes(query)) ||
          (vm.team_name && vm.team_name.toLowerCase().includes(query))
        )
      }

      return filtered
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

    const parseIpAddresses = (ipAddresses) => {
      if (!ipAddresses) return []
      try {
        return JSON.parse(ipAddresses)
      } catch {
        return [ipAddresses]
      }
    }

    const editVM = (vmId) => {
      const vm = vmObjects.value.find(i => i.id === vmId)
      if (vm) {
        selectedVM.value = vm
        showEditVMModal.value = true
      }
    }

    const deleteVM = async (vmId) => {
      if (!confirm('Are you sure you want to delete this VM? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.instances.delete(vmId)
        await fetchData()
        showToast('VM deleted successfully', 'success')
      } catch (err) {
        console.error('Error deleting VM:', err)
        showToast('Failed to delete VM', 'error')
      }
    }

    const unlockVM = async (vmId) => {
      try {
        await api.admin.unlockVM(vmId)
        await fetchData()
        showToast('VM unlocked successfully', 'success')
      } catch (err) {
        console.error('Error unlocking VM:', err)
        showToast('Failed to unlock VM', 'error')
      }
    }

    const lockoutVM = async (vmId) => {
      try {
        await api.admin.lockoutVM(vmId)
        await fetchData()
        showToast('VM locked successfully', 'success')
      } catch (err) {
        console.error('Error locking VM:', err)
        showToast('Failed to lock VM', 'error')
      }
    }

    const closeEditVMModal = () => {
      showEditVMModal.value = false
      selectedVM.value = null
    }

    const onVMUpdated = () => {
      fetchData()
      showToast('VM updated successfully', 'success')
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

    onMounted(() => {
      fetchData()
    })

    return {
      vmObjects,
      competitions,
      loading,
      error,
      vmFilters,
      availableVMTeams,
      filteredVMObjects,
      showEditVMModal,
      selectedVM,
      toast,
      getStatusColor,
      parseIpAddresses,
      editVM,
      deleteVM,
      unlockVM,
      lockoutVM,
      closeEditVMModal,
      onVMUpdated,
      showToast,
      closeToast
    }
  }
}
</script>
