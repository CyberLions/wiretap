<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Providers</h1>
        <button class="btn btn-primary" @click="createProvider">Create Provider</button>
      </div>
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
      <div v-else class="card">
        <div class="card-body overflow-x-auto">
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
</template>

<script>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

export default {
  name: 'Providers',
  setup() {
    const providers = ref([])
    const loading = ref(true)
    const error = ref(null)

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
      // TODO: Show create provider modal
      alert('Create provider modal not implemented')
    }
    const editProvider = (id) => {
      // TODO: Show edit provider modal
      alert('Edit provider modal not implemented')
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
    onMounted(() => {
      fetchProviders()
    })
    return { providers, loading, error, createProvider, editProvider, deleteProvider }
  }
}
</script>