<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Manage VM Lockouts</h3>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>VM Name</th>
                <th>Team</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="vm in lockedVMs" :key="vm.id" class="table-row">
                <td class="table-cell">{{ vm.name }}</td>
                <td class="table-cell">{{ vm.team_name || 'No Team' }}</td>
                <td class="table-cell">
                  <span class="status-badge status-inactive">Locked</span>
                </td>
                <td class="table-cell">
                  <button 
                    @click="unlockVM(vm.id)"
                    class="text-green-400 hover:text-green-300"
                  >
                    Unlock
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

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
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import Toast from '@/components/Toast.vue'

export default {
  name: 'ManageLockouts',
  components: {
    Toast
  },
  setup() {
    const lockedVMs = ref([])
    const loading = ref(false)
    const error = ref(null)
    
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
        
        const response = await api.instances.getAll()
        // Filter locked VMs
        lockedVMs.value = response.data.filter(vm => vm.locked)
      } catch (err) {
        console.error('Error loading locked VMs data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
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
      lockedVMs,
      loading,
      error,
      toast,
      unlockVM,
      showToast,
      closeToast
    }
  }
}
</script>
