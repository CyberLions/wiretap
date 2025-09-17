import { ref, onUnmounted } from 'vue'
import api from '@/services/api'

/**
 * Composable for monitoring instance status changes in the background
 * Provides automatic polling and status updates for power actions
 */
export function useInstanceStatusMonitor(instanceId, options = {}) {
  const {
    pollInterval = 2000, // 2 seconds
    maxPollAttempts = 30, // 1 minute total
    onStatusChange = null,
    onPollComplete = null
  } = options

  const isMonitoring = ref(false)
  const currentStatus = ref(null)
  const currentPowerState = ref(null)
  const pollAttempts = ref(0)
  const error = ref(null)
  const isRebootMonitoring = ref(false)
  const rebootStartTime = ref(null)

  let pollTimer = null

  /**
   * Start monitoring instance status
   * @param {string} initialStatus - The status when monitoring starts
   * @param {string} initialPowerState - The power state when monitoring starts
   * @param {string} action - The power action being performed (optional)
   */
  const startMonitoring = async (initialStatus, initialPowerState, action = null) => {
    if (isMonitoring.value) {
      stopMonitoring()
    }

    currentStatus.value = initialStatus
    currentPowerState.value = initialPowerState
    isMonitoring.value = true
    pollAttempts.value = 0
    error.value = null

    // Detect if this is a reboot action
    isRebootMonitoring.value = action && (action.includes('reboot') || action.includes('restart'))
    rebootStartTime.value = isRebootMonitoring.value ? Date.now() : null

    console.log(`Starting status monitoring for instance ${instanceId}`)
    console.log(`Initial status: ${initialStatus}, power state: ${initialPowerState}`)
    if (isRebootMonitoring.value) {
      console.log(`Reboot monitoring enabled for action: ${action}`)
    }

    // Start polling
    pollTimer = setInterval(async () => {
      await pollStatus()
    }, pollInterval)
  }

  /**
   * Stop monitoring instance status
   */
  const stopMonitoring = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    isMonitoring.value = false
    isRebootMonitoring.value = false
    rebootStartTime.value = null
    console.log(`Stopped status monitoring for instance ${instanceId}`)
  }

  /**
   * Poll the current instance status
   */
  const pollStatus = async () => {
    if (!isMonitoring.value || pollAttempts.value >= maxPollAttempts) {
      if (pollAttempts.value >= maxPollAttempts) {
        console.log(`Max poll attempts reached for instance ${instanceId}`)
        stopMonitoring()
        if (onPollComplete) {
          onPollComplete(currentStatus.value, currentPowerState.value)
        }
      }
      return
    }

    try {
      pollAttempts.value++
      const response = await api.instances.getById(instanceId)
      const instance = response.data

      const newStatus = instance.status
      const newPowerState = instance.power_state

      // Check if status or power state has changed
      if (newStatus !== currentStatus.value || newPowerState !== currentPowerState.value) {
        console.log(`Status change detected for instance ${instanceId}:`)
        console.log(`  Status: ${currentStatus.value} -> ${newStatus}`)
        console.log(`  Power State: ${currentPowerState.value} -> ${newPowerState}`)

        currentStatus.value = newStatus
        currentPowerState.value = newPowerState

        // Notify callback if provided
        if (onStatusChange) {
          onStatusChange(newStatus, newPowerState, instance)
        }
      }

      // Check if we've reached a stable state (regardless of whether status changed)
      if (isStableState(newStatus, newPowerState)) {
        console.log(`Instance ${instanceId} reached stable state: ${newStatus} (power: ${newPowerState || 'null'})`)
        stopMonitoring()
        if (onPollComplete) {
          onPollComplete(newStatus, newPowerState)
        }
      } else {
        // Check if it's an inconsistent state
        const statusLower = newStatus?.toLowerCase()
        const powerStateLower = newPowerState?.toLowerCase()
        if ((statusLower === 'shutoff' && powerStateLower === 'running') ||
            (statusLower === 'running' && powerStateLower === 'shutoff') ||
            (statusLower === 'active' && powerStateLower === 'shutoff') ||
            (statusLower === 'stopped' && powerStateLower === 'running')) {
          console.log(`Instance ${instanceId} has inconsistent state - continuing monitoring: ${newStatus} (power: ${newPowerState || 'null'})`)
        } else {
          console.log(`Instance ${instanceId} still transitioning: ${newStatus} (power: ${newPowerState || 'null'})`)
        }
      }
    } catch (err) {
      console.error(`Error polling status for instance ${instanceId}:`, err)
      error.value = err.response?.data?.message || 'Failed to check instance status'
    }
  }

  /**
   * Check if the instance is in a stable state (not transitioning)
   * @param {string} status - Current status
   * @param {string} powerState - Current power state
   * @returns {boolean} - True if in stable state
   */
  const isStableState = (status, powerState) => {
    const stableStatuses = ['running', 'stopped', 'active', 'inactive', 'shutoff', 'powered_on', 'powered_off']
    const stablePowerStates = ['running', 'stopped', 'shutoff', 'powered_on', 'powered_off']
    
    const statusStable = stableStatuses.includes(status?.toLowerCase())
    const powerStateStable = powerState === null || powerState === undefined || stablePowerStates.includes(powerState?.toLowerCase())
    
    // Both status and power state must be stable
    if (!statusStable || !powerStateStable) {
      return false
    }
    
    // Additional check: status and power state should be consistent
    // If status is SHUTOFF but power state is RUNNING, that's inconsistent and not stable
    const statusLower = status?.toLowerCase()
    const powerStateLower = powerState?.toLowerCase()
    
    // Check for inconsistent states
    if (statusLower === 'shutoff' && powerStateLower === 'running') {
      return false // Inconsistent - status says shutoff but power says running
    }
    if (statusLower === 'running' && powerStateLower === 'shutoff') {
      return false // Inconsistent - status says running but power says shutoff
    }
    if (statusLower === 'active' && powerStateLower === 'shutoff') {
      return false // Inconsistent - status says active but power says shutoff
    }
    if (statusLower === 'stopped' && powerStateLower === 'running') {
      return false // Inconsistent - status says stopped but power says running
    }
    
    // Special handling for reboots: if we're monitoring a reboot, we need to wait longer
    // and look for signs that the reboot actually happened (like status changes)
    if (isRebootMonitoring.value) {
      const timeSinceRebootStart = Date.now() - rebootStartTime.value
      const minRebootTime = 30000 // 30 seconds minimum for reboot
      
      if (timeSinceRebootStart < minRebootTime) {
        console.log(`Reboot monitoring: Not stable yet (${Math.round(timeSinceRebootStart/1000)}s/${minRebootTime/1000}s elapsed)`)
        return false
      }
      
      // For reboots, also check if we've seen any status changes that indicate the reboot happened
      // If the status hasn't changed at all during reboot monitoring, it might not have actually rebooted
      if (pollAttempts.value < 5) {
        console.log(`Reboot monitoring: Need more polls to detect status changes (${pollAttempts.value}/5)`)
        return false
      }
    }
    
    return true
  }

  /**
   * Get the current monitoring state
   */
  const getMonitoringState = () => ({
    isMonitoring: isMonitoring.value,
    currentStatus: currentStatus.value,
    currentPowerState: currentPowerState.value,
    pollAttempts: pollAttempts.value,
    error: error.value
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopMonitoring()
  })

  return {
    isMonitoring,
    currentStatus,
    currentPowerState,
    pollAttempts,
    error,
    startMonitoring,
    stopMonitoring,
    getMonitoringState
  }
}
