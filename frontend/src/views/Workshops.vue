<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Workshop Management</h3>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="workshop in workshops"
            :key="workshop.id"
            class="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            @click="viewWorkshop(workshop.id)"
          >
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-lg font-medium text-white">{{ workshop.name }}</h4>
              <span 
                :class="[
                  'status-badge text-xs',
                  workshop.enabled ? 'status-active' : 'status-inactive'
                ]"
              >
                {{ workshop.enabled ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p class="text-gray-400 text-sm mb-4">{{ workshop.description || 'No description' }}</p>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Provider:</span>
                <span class="text-gray-300">{{ workshop.provider_name || 'Unknown' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Project:</span>
                <span class="text-gray-300">{{ workshop.openstack_project_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Teams:</span>
                <span class="text-gray-300">{{ workshop.teams?.length || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Instances:</span>
                <span class="text-gray-300">{{ workshop.instance_count || 0 }}</span>
              </div>
            </div>
            
            <div class="mt-4 flex justify-between items-center">
              <span class="text-xs text-gray-500">
                Created {{ formatDate(workshop.created_at) }}
              </span>
              <div class="flex space-x-2">
                <button 
                  @click.stop="editWorkshop(workshop.id)"
                  class="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Edit
                </button>
                <button 
                  @click.stop="deleteWorkshop(workshop.id)"
                  class="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Workshop Modal -->
    <AddWorkshopModal
      :show="showAddWorkshopModal"
      :providers="providers"
      @close="closeAddWorkshopModal"
      @created="onWorkshopCreated"
      @error="(message) => showToast(message, 'error')"
    />

    <!-- Edit Workshop Modal -->
    <EditWorkshopModal
      :show="showEditWorkshopModal"
      :workshop="selectedWorkshop"
      :providers="providers"
      @close="closeEditWorkshopModal"
      @updated="onWorkshopUpdated"
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
import { useRouter } from 'vue-router'
import api from '@/services/api'
import AddWorkshopModal from '@/components/AddWorkshopModal.vue'
import EditWorkshopModal from '@/components/EditWorkshopModal.vue'
import Toast from '@/components/Toast.vue'

export default {
  name: 'Workshops',
  components: {
    AddWorkshopModal,
    EditWorkshopModal,
    Toast
  },
  setup() {
    const router = useRouter()
    
    const workshops = ref([])
    const providers = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // Modal states
    const showAddWorkshopModal = ref(false)
    const showEditWorkshopModal = ref(false)
    const selectedWorkshop = ref(null)
    
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
        
        const [workshopsResponse, providersResponse] = await Promise.all([
          api.workshops.getAll(),
          api.providers.getAll()
        ])
        
        workshops.value = workshopsResponse.data
        providers.value = providersResponse.data
      } catch (err) {
        console.error('Error loading workshops data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const viewWorkshop = (workshopId) => {
      router.push(`/workshops/${workshopId}`)
    }

    const editWorkshop = (workshopId) => {
      const workshop = workshops.value.find(w => w.id === workshopId)
      if (workshop) {
        selectedWorkshop.value = workshop
        showEditWorkshopModal.value = true
      }
    }

    const deleteWorkshop = async (workshopId) => {
      if (!confirm('Are you sure you want to delete this workshop? This will also delete all teams and generated users (@workshop.local) in this workshop. This action cannot be undone.')) {
        return
      }
      
      try {
        const response = await api.workshops.delete(workshopId)
        await fetchData()
        showToast(response.data.message || 'Workshop deleted successfully', 'success')
      } catch (err) {
        console.error('Error deleting workshop:', err)
        const errorMessage = err.response?.data?.error || 'Failed to delete workshop'
        showToast(errorMessage, 'error')
      }
    }

    const closeAddWorkshopModal = () => {
      showAddWorkshopModal.value = false
    }

    const closeEditWorkshopModal = () => {
      showEditWorkshopModal.value = false
      selectedWorkshop.value = null
    }

    const onWorkshopCreated = () => {
      fetchData()
      showToast('Workshop created successfully', 'success')
    }

    const onWorkshopUpdated = () => {
      fetchData()
      showToast('Workshop updated successfully', 'success')
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
      if (!dateString) return 'Unknown'
      return new Date(dateString).toLocaleDateString()
    }

    onMounted(() => {
      fetchData()
    })

    return {
      workshops,
      providers,
      loading,
      error,
      showAddWorkshopModal,
      showEditWorkshopModal,
      selectedWorkshop,
      toast,
      viewWorkshop,
      editWorkshop,
      deleteWorkshop,
      closeAddWorkshopModal,
      closeEditWorkshopModal,
      onWorkshopCreated,
      onWorkshopUpdated,
      showToast,
      closeToast,
      formatDate
    }
  }
}
</script>
