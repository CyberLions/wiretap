<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Add New Service Account</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Account Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter service account name"
          />
        </div>
        

        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Creating...</span>
            <span v-else>Create Service Account</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import api from '@/services/api'

export default {
  name: 'AddServiceAccountModal',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'created', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const form = ref({
      name: ''
    })

    const resetForm = () => {
      form.value = {
        name: ''
      }
    }

    const handleSubmit = async () => {
      loading.value = true
      try {
        await api.admin.createServiceAccount(form.value)
        emit('created')
        emit('close')
        resetForm()
      } catch (error) {
        console.error('Error creating service account:', error)
        // Emit error event for parent to handle
        emit('error', error.response?.data?.error || 'Failed to create service account')
      } finally {
        loading.value = false
      }
    }

    // Reset form when modal closes
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        resetForm()
      }
    })

    return {
      loading,
      form,
      handleSubmit
    }
  }
}
</script> 