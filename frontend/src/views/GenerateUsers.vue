<template>
  <div class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Generate Users</h3>
      </div>
      <div class="p-6">
        <div class="max-w-md space-y-4">
          <div>
            <label class="form-label">Number of Users</label>
            <input 
              v-model.number="generateForm.count" 
              type="number" 
              class="form-input" 
              min="1" 
              max="100" 
            />
          </div>
          <div>
            <label class="form-label">Username Prefix</label>
            <input 
              v-model="generateForm.prefix" 
              type="text" 
              class="form-input" 
            />
          </div>
          <div>
            <label class="form-label">Competition</label>
            <select 
              v-model="generateForm.competitionId" 
              class="form-input"
            >
              <option value="">Select a competition</option>
              <option v-for="competition in competitions" :key="competition.id" :value="competition.id">
                {{ competition.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="form-label">Users per Team</label>
            <input 
              v-model.number="generateForm.usersPerTeam" 
              type="number" 
              class="form-input" 
              min="1" 
              max="10" 
            />
          </div>
          <div>
            <label class="form-label">Password Generation</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input 
                  type="radio" 
                  v-model="generateForm.passwordType" 
                  value="random" 
                  class="mr-2"
                />
                <span class="text-gray-300">Generate random passwords</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="radio" 
                  v-model="generateForm.passwordType" 
                  value="custom" 
                  class="mr-2"
                />
                <span class="text-gray-300">Use custom password</span>
              </label>
            </div>
          </div>
          <div v-if="generateForm.passwordType === 'custom'">
            <label class="form-label">Custom Password</label>
            <input 
              v-model="generateForm.password" 
              type="password" 
              class="form-input" 
            />
          </div>
          <div v-if="generateForm.passwordType === 'random'">
            <label class="form-label">Password Length</label>
            <input 
              v-model.number="generateForm.passwordLength" 
              type="number" 
              class="form-input" 
              min="8" 
              max="20" 
            />
          </div>
          <button 
            @click="generateUsers"
            :disabled="!isGenerateFormValid"
            class="btn btn-primary w-full"
            :class="{ 'opacity-50 cursor-not-allowed': !isGenerateFormValid }"
          >
            Generate Users
          </button>
          <div v-if="!isGenerateFormValid" class="text-sm text-red-400 mt-2">
            Please fill in all required fields and ensure password settings are valid.
          </div>
        </div>
      </div>
    </div>

    <!-- Generated Users Modal -->
    <GeneratedUsersModal
      :show="showGeneratedUsersModal"
      :users="generatedUsersData.users"
      :teams="generatedUsersData.teams"
      :message="generatedUsersData.message"
      @close="closeGeneratedUsersModal"
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
import GeneratedUsersModal from '@/components/GeneratedUsersModal.vue'
import Toast from '@/components/Toast.vue'

export default {
  name: 'GenerateUsers',
  components: {
    GeneratedUsersModal,
    Toast
  },
  setup() {
    const competitions = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    // Modal states
    const showGeneratedUsersModal = ref(false)
    
    // Generated users data
    const generatedUsersData = ref({
      users: [],
      teams: [],
      message: ''
    })
    
    // Forms
    const generateForm = ref({
      count: 10,
      prefix: 'user',
      password: 'password123',
      competitionId: '',
      usersPerTeam: 4,
      passwordType: 'random',
      passwordLength: 12
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
        
        const response = await api.workshops.getAll()
        competitions.value = response.data
      } catch (err) {
        console.error('Error loading competitions data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    // Computed property for generate form validation
    const isGenerateFormValid = computed(() => {
      const { count, prefix, passwordType, password, passwordLength, competitionId, usersPerTeam } = generateForm.value
      
      if (!count || !prefix || !competitionId || !usersPerTeam) {
        return false
      }
      
      if (passwordType === 'custom' && !password) {
        return false
      }
      
      if (passwordType === 'random' && (!passwordLength || passwordLength < 8 || passwordLength > 20)) {
        return false
      }
      
      return true
    })

    const generateUsers = async () => {
      try {
        const formData = { ...generateForm.value }
        
        // If using random passwords, don't send the password field
        if (formData.passwordType === 'random') {
          delete formData.password
        } else {
          // If using custom password, don't send passwordLength
          delete formData.passwordLength
        }
        
        // Remove the passwordType from the request
        delete formData.passwordType
        
        const response = await api.users.generateUsers(formData)
        
        // Store generated users data for modal
        generatedUsersData.value = {
          users: response.data.users || [],
          teams: response.data.teams || [],
          message: response.data.message || 'Users generated successfully'
        }
        
        // Show modal with generated users
        showGeneratedUsersModal.value = true
        
        // Refresh data
        await fetchData()
      } catch (err) {
        console.error('Error generating users:', err)
        const errorMessage = err.response?.data?.error || 'Failed to generate users'
        showToast(errorMessage, 'error')
      }
    }

    const closeGeneratedUsersModal = () => {
      showGeneratedUsersModal.value = false
      generatedUsersData.value = { users: [], teams: [], message: '' }
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
      competitions,
      loading,
      error,
      generateForm,
      isGenerateFormValid,
      showGeneratedUsersModal,
      generatedUsersData,
      toast,
      generateUsers,
      closeGeneratedUsersModal,
      showToast,
      closeToast
    }
  }
}
</script>
