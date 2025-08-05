<template>
  <div class="min-h-screen bg-gray-900 flex">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0">
      <div class="p-6">
        <!-- Navigation Menu -->
        <nav class="space-y-2">
          <button
            v-for="item in navigationItems"
            :key="item.id"
            @click="selectTab(item.id)"
            class="w-full flex items-center px-4 py-3 text-left rounded-md transition-colors duration-200"
            :class="selectedTab === item.id 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'"
          >
            <component :is="item.icon" class="w-5 h-5 mr-3" />
            {{ item.name }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Content Header -->
      <div class="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-white">{{ getCurrentTabName() }}</h1>
          <button
            v-if="showAddButton"
            @click="showAddModal = true"
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add {{ getCurrentTabName().slice(0, -1) }}
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 p-6">
        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center h-64">
          <div class="text-center">
            <div class="spinner w-8 h-8 mx-auto mb-4"></div>
            <p class="text-gray-400">Loading...</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <div class="text-red-400 text-lg mb-4">{{ error }}</div>
          <button
            @click="loadData"
            class="btn btn-primary"
          >
            Try Again
          </button>
        </div>

        <!-- Users Tab -->
        <div v-else-if="selectedTab === 'users'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">User Management</h3>
            </div>
            <div class="p-6">
              <div class="overflow-x-auto">
                <table class="table">
                  <thead class="table-header">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Team</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody class="table-body">
                    <tr v-for="user in users" :key="user.id" class="table-row">
                      <td class="table-cell">{{ user.first_name }} {{ user.last_name }}</td>
                      <td class="table-cell">{{ user.email }}</td>
                      <td class="table-cell">
                        <span class="status-badge" :class="user.role === 'ADMIN' ? 'status-active' : 'status-pending'">
                          {{ user.role }}
                        </span>
                      </td>
                      <td class="table-cell">{{ user.team?.name || 'None' }}</td>
                      <td class="table-cell">
                        <span class="status-badge" :class="user.enabled ? 'status-active' : 'status-inactive'">
                          {{ user.enabled ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td class="table-cell">
                        <div class="flex space-x-2">
                          <button @click="editUser(user.id)" class="text-blue-400 hover:text-blue-300">Edit</button>
                          <button @click="deleteUser(user.id)" class="text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Competitions Tab -->
        <div v-else-if="selectedTab === 'competitions'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">Competition Management</h3>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                  v-for="competition in competitions"
                  :key="competition.id"
                  class="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <h4 class="text-lg font-medium text-white mb-2">{{ competition.name }}</h4>
                  <p class="text-gray-400 text-sm mb-4">{{ competition.description }}</p>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-300">{{ competition.teams?.length || 0 }} teams</span>
                    <div class="flex space-x-2">
                      <button @click="editCompetition(competition.id)" class="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button @click="deleteCompetition(competition.id)" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Teams Tab -->
        <div v-else-if="selectedTab === 'teams'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">Team Management</h3>
            </div>
            <div class="p-6">
              <div class="overflow-x-auto">
                <table class="table">
                  <thead class="table-header">
                    <tr>
                      <th>Team Name</th>
                      <th>Number</th>
                      <th>Competition</th>
                      <th>Members</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody class="table-body">
                    <tr v-for="team in teams" :key="team.id" class="table-row">
                      <td class="table-cell">{{ team.name }}</td>
                      <td class="table-cell">{{ team.number }}</td>
                      <td class="table-cell">{{ team.workshop?.name || 'Unknown' }}</td>
                      <td class="table-cell">{{ team.members?.length || 0 }} members</td>
                      <td class="table-cell">
                        <div class="flex space-x-2">
                          <button @click="editTeam(team.id)" class="text-blue-400 hover:text-blue-300">Edit</button>
                          <button @click="deleteTeam(team.id)" class="text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- VM Objects Tab -->
        <div v-else-if="selectedTab === 'vm-objects'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">VM Object Management</h3>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                  v-for="vm in vmObjects"
                  :key="vm.id"
                  class="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-lg font-medium text-white">{{ vm.name }}</h4>
                    <div
                      class="w-3 h-3 rounded-full"
                      :class="getStatusColor(vm.status)"
                    ></div>
                  </div>
                  <p class="text-gray-400 text-sm mb-2">{{ vm.ip_addresses?.join(', ') || 'No IP addresses' }}</p>
                  <p class="text-gray-400 text-sm mb-4">Team: {{ vm.team?.name || 'No Team' }}</p>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-300">{{ vm.status }}</span>
                    <div class="flex space-x-2">
                      <button @click="editVM(vm.id)" class="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button @click="deleteVM(vm.id)" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Providers Tab -->
        <div v-else-if="selectedTab === 'providers'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">Provider Management</h3>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  v-for="provider in providers"
                  :key="provider.id"
                  class="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <h4 class="text-lg font-medium text-white mb-2">{{ provider.name }}</h4>
                  <p class="text-gray-400 text-sm mb-2">Type: {{ provider.type }}</p>
                  <p class="text-gray-400 text-sm mb-4">{{ provider.description }}</p>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-300">{{ provider.enabled ? 'Active' : 'Inactive' }}</span>
                    <div class="flex space-x-2">
                      <button class="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Service Accounts Tab -->
        <div v-else-if="selectedTab === 'service-accounts'" class="space-y-6">
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
                          <button class="text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Ingest VMs Tab -->
        <div v-else-if="selectedTab === 'ingest-vms'" class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <div class="px-6 py-4 border-b border-gray-700">
              <h3 class="text-lg font-medium text-white">Ingest VMs from Provider</h3>
            </div>
            <div class="p-6">
              <div class="max-w-md space-y-4">
                <div>
                  <label class="form-label">Select Provider</label>
                  <select v-model="ingestForm.providerId" class="form-input">
                    <option value="">Choose a provider</option>
                    <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                      {{ provider.name }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Select Team</label>
                  <select v-model="ingestForm.teamId" class="form-input">
                    <option value="">Choose a team</option>
                    <option v-for="team in teams" :key="team.id" :value="team.id">
                      {{ team.name }}
                    </option>
                  </select>
                </div>
                <button 
                  @click="ingestVMs"
                  :disabled="!ingestForm.providerId || !ingestForm.teamId"
                  class="btn btn-primary w-full"
                >
                  Ingest VMs
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Generate Users Tab -->
        <div v-else-if="selectedTab === 'generate-users'" class="space-y-6">
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
                  <label class="form-label">Default Password</label>
                  <input 
                    v-model="generateForm.password" 
                    type="password" 
                    class="form-input" 
                  />
                </div>
                <button 
                  @click="generateUsers"
                  :disabled="!generateForm.count || !generateForm.prefix || !generateForm.password"
                  class="btn btn-primary w-full"
                >
                  Generate Users
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Manage Lockouts Tab -->
        <div v-else-if="selectedTab === 'manage-lockouts'" class="space-y-6">
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
                      <td class="table-cell">{{ vm.team?.name || 'No Team' }}</td>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import api from '@/services/api'

// Icon components (simplified for demo)
const UserIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>' }
const CompetitionIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>' }
const TeamIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>' }
const VMIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>' }
const ProviderIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>' }
const ServiceAccountIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>' }
const ImportIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>' }
const GenerateIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>' }
const LockIcon = { template: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>' }

export default {
  name: 'Admin',
  components: {
    UserIcon,
    CompetitionIcon,
    TeamIcon,
    VMIcon,
    ProviderIcon,
    ServiceAccountIcon,
    ImportIcon,
    GenerateIcon,
    LockIcon
  },
  setup() {
    const { user } = useAuth()
    
    const loading = ref(false)
    const error = ref(null)
    const selectedTab = ref('users')
    const showAddModal = ref(false)

    // Data
    const users = ref([])
    const competitions = ref([])
    const teams = ref([])
    const vmObjects = ref([])
    const providers = ref([])
    const serviceAccounts = ref([])
    const lockedVMs = ref([])

    // Forms
    const ingestForm = ref({
      providerId: '',
      teamId: ''
    })

    const generateForm = ref({
      count: 10,
      prefix: 'user',
      password: 'password123'
    })

    const navigationItems = [
      { id: 'users', name: 'Users', icon: 'UserIcon' },
      { id: 'competitions', name: 'Competitions', icon: 'CompetitionIcon' },
      { id: 'teams', name: 'Teams', icon: 'TeamIcon' },
      { id: 'vm-objects', name: 'VM Objects', icon: 'VMIcon' },
      { id: 'providers', name: 'Providers', icon: 'ProviderIcon' },
      { id: 'service-accounts', name: 'Service Accounts', icon: 'ServiceAccountIcon' },
      { id: 'ingest-vms', name: 'Ingest VMs', icon: 'ImportIcon' },
      { id: 'generate-users', name: 'Generate Users', icon: 'GenerateIcon' },
      { id: 'manage-lockouts', name: 'Manage Lockouts', icon: 'LockIcon' }
    ]

    const showAddButton = computed(() => {
      return ['users', 'competitions', 'teams', 'vm-objects', 'providers', 'service-accounts'].includes(selectedTab.value)
    })

    const getCurrentTabName = () => {
      const item = navigationItems.find(item => item.id === selectedTab.value)
      return item ? item.name : ''
    }

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'running':
        case 'active':
          return 'bg-green-500'
        case 'stopped':
        case 'shutoff':
          return 'bg-red-500'
        case 'rebooting':
        case 'building':
          return 'bg-yellow-500'
        default:
          return 'bg-gray-500'
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Never'
      return new Date(dateString).toLocaleDateString()
    }

    const loadData = async () => {
      loading.value = true
      error.value = null
      
      try {
        const [
          usersResponse,
          competitionsResponse,
          teamsResponse,
          vmObjectsResponse,
          providersResponse,
          serviceAccountsResponse
        ] = await Promise.all([
          api.users.getAll(),
          api.workshops.getAll(),
          api.teams.getAll(),
          api.instances.getAll(),
          api.providers.getAll(),
          api.admin.getServiceAccounts()
        ])

        users.value = usersResponse.data
        competitions.value = competitionsResponse.data
        teams.value = teamsResponse.data
        vmObjects.value = vmObjectsResponse.data
        providers.value = providersResponse.data
        serviceAccounts.value = serviceAccountsResponse.data

        // Filter locked VMs
        lockedVMs.value = vmObjects.value.filter(vm => vm.locked)
      } catch (err) {
        console.error('Error loading admin data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const selectTab = (tabId) => {
      selectedTab.value = tabId
    }

    const ingestVMs = async () => {
      try {
        await api.providers.ingestVMs(ingestForm.value.providerId, {
          team_id: ingestForm.value.teamId
        })
        // Refresh data
        await loadData()
      } catch (err) {
        console.error('Error ingesting VMs:', err)
      }
    }

    const generateUsers = async () => {
      try {
        await api.users.generateUsers(generateForm.value)
        // Refresh data
        await loadData()
      } catch (err) {
        console.error('Error generating users:', err)
      }
    }

    const unlockVM = async (vmId) => {
      try {
        await api.admin.unlockVM(vmId)
        // Refresh data
        await loadData()
      } catch (err) {
        console.error('Error unlocking VM:', err)
      }
    }

    const editUser = async (userId) => {
      // TODO: Implement edit user modal
      console.log('Edit user:', userId)
    }

    const deleteUser = async (userId) => {
      if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.users.delete(userId)
        await loadData()
      } catch (err) {
        console.error('Error deleting user:', err)
      }
    }

    const editCompetition = async (competitionId) => {
      // TODO: Implement edit competition modal
      console.log('Edit competition:', competitionId)
    }

    const deleteCompetition = async (competitionId) => {
      if (!confirm('Are you sure you want to delete this competition? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.workshops.delete(competitionId)
        await loadData()
      } catch (err) {
        console.error('Error deleting competition:', err)
      }
    }

    const editTeam = async (teamId) => {
      // TODO: Implement edit team modal
      console.log('Edit team:', teamId)
    }

    const deleteTeam = async (teamId) => {
      if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.teams.delete(teamId)
        await loadData()
      } catch (err) {
        console.error('Error deleting team:', err)
      }
    }

    const editVM = async (vmId) => {
      // TODO: Implement edit VM modal
      console.log('Edit VM:', vmId)
    }

    const deleteVM = async (vmId) => {
      if (!confirm('Are you sure you want to delete this VM? This action cannot be undone.')) {
        return
      }
      
      try {
        await api.instances.delete(vmId)
        await loadData()
      } catch (err) {
        console.error('Error deleting VM:', err)
      }
    }

    onMounted(() => {
      loadData()
    })

    return {
      loading,
      error,
      selectedTab,
      showAddModal,
      users,
      competitions,
      teams,
      vmObjects,
      providers,
      serviceAccounts,
      lockedVMs,
      ingestForm,
      generateForm,
      navigationItems,
      showAddButton,
      getCurrentTabName,
      getStatusColor,
      formatDate,
      loadData,
      selectTab,
      ingestVMs,
      generateUsers,
      unlockVM,
      editUser,
      deleteUser,
      editCompetition,
      deleteCompetition,
      editTeam,
      deleteTeam,
      editVM,
      deleteVM
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style>