<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Service Account Management</h3>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>Name</th>
                <th>API Key</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="account in serviceAccounts" :key="account.id" class="table-row">
                <td class="table-cell">{{ account.name }}</td>
                <td class="table-cell font-mono text-sm">{{ account.api_key }}</td>
                <td class="table-cell">{{ formatDate(account.created_at) }}</td>
                <td class="table-cell">{{ formatDate(account.last_used) }}</td>
                <td class="table-cell">
                  <div class="flex space-x-2">
                    <button class="text-blue-400 hover:text-blue-300">Edit</button>
                    <button @click="deleteServiceAccount(account.id)" class="text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add Service Account Modal -->
    <AddServiceAccountModal
      :show="showAddServiceAccountModal"
      @close="closeAddServiceAccountModal"
      @created="onServiceAccountCreated"
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
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import AddServiceAccountModal from '@/components/AddServiceAccountModal.vue'
import Toast from '@/components/Toast.vue'

export default {
  name: 'ServiceAccounts',
  components: {
    AddServiceAccountModal,
    Toast
  },
  setup() {
    const serviceAccounts = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // Modal states
    const showAddServiceAccountModal = ref(false)
    
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
        
        const response = await api.admin.getServiceAccounts()
        serviceAccounts.value = response.data
      } catch (err) {
        console.error('Error loading service accounts data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const deleteServiceAccount = async (accountId) => {
      if (!confirm('Are you sure you want to delete this service account? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.admin.deleteServiceAccount(accountId)
        await fetchData()
        showToast('Service account deleted successfully', 'success')
      } catch (err) {
        console.error('Error deleting service account:', err)
        showToast('Failed to delete service account', 'error')
      }
    }

    const closeAddServiceAccountModal = () => {
      showAddServiceAccountModal.value = false
    }

    const onServiceAccountCreated = () => {
      fetchData()
      showToast('Service account created successfully', 'success')
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

    const formatDate = (dateString) => {
      if (!dateString) return 'Never'
      return new Date(dateString).toLocaleDateString()
    }

    onMounted(() => {
      fetchData()
    })

    return {
      serviceAccounts,
      loading,
      error,
      showAddServiceAccountModal,
      toast,
      deleteServiceAccount,
      closeAddServiceAccountModal,
      onServiceAccountCreated,
      showToast,
      closeToast,
      formatDate
    }
  }
}
</script>
