<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">Providers</h3>
          <button class="btn btn-primary" @click="createProvider">Create Provider</button>
        </div>
      </div>
      <div class="p-6">
        <div v-if="loading" class="flex justify-center items-center py-12">
          <div class="spinner w-8 h-8"></div>
          <span class="ml-3 text-gray-400">Loading providers...</span>
        </div>
        <div v-else-if="error" class="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
          <div class="flex items-center">
            <svg class="h-6 w-6 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-1.414 1.414M6.343 17.657l-1.414-1.414M6.343 6.343l1.414-1.414M17.657 17.657l1.414-1.414M12 8v4m0 4h.01" />
            </svg>
            <span class="text-red-300">{{ error }}</span>
          </div>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Auth URL</th>
                <th>Region</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="provider in providers" :key="provider.id" class="table-row">
                <td class="table-cell">{{ provider.name }}</td>
                <td class="table-cell">{{ provider.description }}</td>
                <td class="table-cell">{{ provider.auth_url }}</td>
                <td class="table-cell">{{ provider.region_name }}</td>
                <td class="table-cell">
                  <div class="flex space-x-2">
                    <button class="btn btn-secondary text-xs" @click="editProvider(provider.id)">Edit</button>
                    <button class="btn btn-danger text-xs" @click="deleteProvider(provider.id)">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Provider Modal -->
  <CreateProviderModal
    :show="showCreateProviderModal"
    @close="showCreateProviderModal = false"
    @created="onProviderCreated"
    @error="(message) => error = message"
  />

  <!-- Edit Provider Modal -->
  <EditProviderModal
    :show="showEditProviderModal"
    :provider="selectedProvider"
    @close="showEditProviderModal = false"
    @updated="onProviderUpdated"
    @error="(message) => error = message"
  />
</template>

<script>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import CreateProviderModal from '@/components/CreateProviderModal.vue'
import EditProviderModal from '@/components/EditProviderModal.vue'

export default {
  name: 'Providers',
  components: {
    CreateProviderModal,
    EditProviderModal
  },
  setup() {
    const providers = ref([])
    const loading = ref(true)
    const error = ref(null)
    const showCreateProviderModal = ref(false)
    const showEditProviderModal = ref(false)
    const selectedProvider = ref(null)

    const fetchProviders = async () => {
      try {
        loading.value = true
        error.value = null
        const response = await api.get('/providers')
        providers.value = response.data
      } catch (err) {
        error.value = err.response?.data?.message || 'Failed to load providers'
      } finally {
        loading.value = false
      }
    }

    const createProvider = () => {
      showCreateProviderModal.value = true
    }
    

    const editProvider = (id) => {
      const provider = providers.value.find(p => p.id === id)
      if (provider) {
        selectedProvider.value = provider
        showEditProviderModal.value = true
      }
    }
    const deleteProvider = async (id) => {
      if (!confirm('Are you sure you want to delete this provider?')) return
      try {
        await api.delete(`/providers/${id}`)
        await fetchProviders()
      } catch (err) {
        alert('Failed to delete provider')
      }
    }

    const onProviderCreated = async () => {
      await fetchProviders()
    }

    const onProviderUpdated = async () => {
      await fetchProviders()
    }

    onMounted(() => {
      fetchProviders()
    })
    return { 
      providers, 
      loading, 
      error, 
      showCreateProviderModal,
      showEditProviderModal,
      selectedProvider,
      createProvider, 
      editProvider, 
      deleteProvider,
      onProviderCreated,
      onProviderUpdated
    }
  }
}
</script>