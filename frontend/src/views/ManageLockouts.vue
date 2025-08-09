<template>
  <div class="space-y-6">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center py-8">
      <div class="text-gray-400">Loading...</div>
    </div>
    
    <div v-else-if="error" class="bg-red-900 border border-red-700 rounded-lg p-4">
      <div class="text-red-200">{{ error }}</div>
      <button @click="fetchData" class="mt-2 text-red-300 hover:text-red-100 underline">Retry</button>
    </div>

    <template v-else>
      <!-- Scheduled Lockouts Section -->
      <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
        <div class="px-6 py-4 border-b border-gray-700">
          <h3 class="text-lg font-medium text-white">Scheduled Lockouts / Unlocks</h3>
          <div class="text-sm text-gray-400 mt-1 space-y-1">
            <p>Times shown in your local timezone ({{ userTimezone }})</p>
            <p v-if="serverTime" class="text-xs">
              Server time: {{ formatDateTime(serverTime) }} (UTC)
            </p>
            <p v-if="localTime" class="text-xs">
              Your local time: {{ formatDateTime(localTime) }}
            </p>
          </div>
        </div>
        <div class="p-6">
          <div v-if="schedules.length === 0" class="text-gray-400">No scheduled lockout windows.</div>
          <div v-else class="overflow-x-auto">
            <table class="table">
              <thead class="table-header">
                <tr>
                  <th>Workshop</th>
                  <th>Start (Local)</th>
                  <th>End (Local)</th>
                  <th>Current State</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody class="table-body">
                <tr v-for="item in schedules" :key="item.id" class="table-row">
                  <td class="table-cell">{{ item.name }}</td>
                  <td class="table-cell">{{ formatDateTime(item.lockout_start_local) || '—' }}</td>
                  <td class="table-cell">{{ formatDateTime(item.lockout_end_local) || '—' }}</td>
                  <td class="table-cell">
                    <span :class="['status-badge', item.nowLocked ? 'status-inactive' : 'status-active']">
                      {{ item.nowLocked ? 'Locked' : 'Unlocked' }}
                    </span>
                  </td>
                  <td class="table-cell">
                    <span v-if="item.nextAction">{{ item.nextAction.type }} at {{ formatDateTime(item.nextAction.at) }}</span>
                    <span v-else>—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Locked VMs Section -->
      <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
        <div class="px-6 py-4 border-b border-gray-700">
          <h3 class="text-lg font-medium text-white">Currently Locked VMs</h3>
          <p class="text-sm text-gray-400 mt-1">VMs that are manually locked or locked due to schedule</p>
        </div>
        <div class="p-6">
          <div v-if="lockedVMs.length === 0" class="text-gray-400 text-center py-8">
            No VMs are currently locked.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table">
              <thead class="table-header">
                <tr>
                  <th>VM Name</th>
                  <th>Team</th>
                  <th>Workshop</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody class="table-body">
                <tr v-for="vm in lockedVMs" :key="vm.id" class="table-row">
                  <td class="table-cell">{{ vm.name }}</td>
                  <td class="table-cell">{{ vm.team_name || 'No Team' }}</td>
                  <td class="table-cell">{{ vm.workshop_name || 'Unknown' }}</td>
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
    </template>

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
import { ref, onMounted, computed } from 'vue'
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
    const schedules = ref([])
    const serverTime = ref(null)
    const localTime = ref(null)
    
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
        
        // Get user's timezone offset in minutes
        const timezoneOffset = new Date().getTimezoneOffset();
        
        const [instancesResponse, scheduleResponse] = await Promise.all([
          api.instances.getAll(),
          api.admin.getLockoutSchedule(timezoneOffset)
        ])
        
        // Filter locked VMs
        lockedVMs.value = instancesResponse.data.filter(vm => vm.locked)
        schedules.value = scheduleResponse.data.schedule || []
        
        // Set server and local times for display
        if (scheduleResponse.data.now) {
          serverTime.value = scheduleResponse.data.now;
        }
        if (scheduleResponse.data.now_local) {
          localTime.value = scheduleResponse.data.now_local;
        }
      } catch (err) {
        console.error('Error loading lockout data:', err)
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

    const formatDateTime = (dateString) => {
      if (!dateString) return '—'
      try {
        // Handle both ISO and MySQL timestamp formats
        let date;
        if (typeof dateString === 'string') {
          // Handle MySQL timestamp format (YYYY-MM-DD HH:MM:SS)
          if (dateString.includes(' ')) {
            date = new Date(dateString.replace(' ', 'T') + 'Z');
          } else {
            date = new Date(dateString);
          }
        } else {
          date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
          console.warn('Invalid date string:', dateString);
          return '—';
        }
        
        // Format in user's local timezone with timezone indicator
        return date.toLocaleString() + ' (Local)';
      } catch (e) {
        console.error("Error formatting date:", e, dateString);
        return '—';
      }
    }

    // Get user's timezone name
    const userTimezone = computed(() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return 'Local Time';
      }
    });

    onMounted(() => {
      fetchData()
    })

    return {
      lockedVMs,
      loading,
      error,
      schedules,
      serverTime,
      localTime,
      toast,
      unlockVM,
      showToast,
      closeToast,
      formatDateTime,
      userTimezone
    }
  }
}
</script>
