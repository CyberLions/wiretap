<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop">
      <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-700">
          <h3 class="text-lg font-medium text-white">Assigning VMs</h3>
        </div>
        
        <div class="p-6">
          <!-- Progress Overview -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-300">Progress</span>
              <span class="text-sm text-gray-400">{{ completed }} of {{ total }}</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div 
                class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${progressPercentage}%` }"
              ></div>
            </div>
          </div>

          <!-- Current Status -->
          <div class="mb-4">
            <div class="flex items-center mb-2">
              <div v-if="isLoading" class="spinner w-4 h-4 mr-2"></div>
              <span class="text-sm text-gray-300">{{ currentStatus }}</span>
            </div>
            <div v-if="currentTeam" class="text-xs text-gray-400">
              Assigning to: {{ currentTeam }}
            </div>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="successMessage" class="mb-4 p-3 bg-green-900 border border-green-700 rounded-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-green-400 text-sm">{{ successMessage }}</span>
            </div>
          </div>

          <div v-if="errorMessage" class="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="text-red-400 text-sm">{{ errorMessage }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3">
            <button
              v-if="!isLoading && (successMessage || errorMessage)"
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              Close
            </button>
            <button
              v-if="isLoading"
              @click="$emit('cancel')"
              class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'AssignmentProgressModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    currentStatus: {
      type: String,
      default: ''
    },
    currentTeam: {
      type: String,
      default: ''
    },
    successMessage: {
      type: String,
      default: ''
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'cancel'],
  computed: {
    progressPercentage() {
      if (this.total === 0) return 0
      return Math.round((this.completed / this.total) * 100)
    }
  }
}
</script>
