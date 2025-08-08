<template>
  <div class="min-h-screen bg-gray-900 flex">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0">
      <div class="p-6">
        <!-- Navigation Menu -->
        <nav class="space-y-4">
          <div v-for="section in navigationSections" :key="section.name" class="space-y-2">
            <!-- Section Header -->
            <div class="px-4 py-2">
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {{ section.name }}
              </h3>
            </div>
            
            <!-- Section Items -->
            <div class="space-y-1">
              <button
                v-for="item in section.items"
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
            </div>
          </div>
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
            @click="handleAddClick"
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

        <!-- Dynamic Content Based on Selected Tab -->
        <div v-else>
          <!-- Providers Tab -->
          <div v-if="selectedTab === 'providers'">
            <Providers />
          </div>

          <!-- Users Tab -->
          <div v-else-if="selectedTab === 'users'">
            <Users />
          </div>

          <!-- Workshops Tab -->
          <div v-else-if="selectedTab === 'workshops'">
            <Workshops />
          </div>

          <!-- Teams Tab -->
          <div v-else-if="selectedTab === 'teams'">
            <Teams />
          </div>

          <!-- VM Objects Tab -->
          <div v-else-if="selectedTab === 'vm-objects'">
            <VMObjects />
          </div>

          <!-- Service Accounts Tab -->
          <div v-else-if="selectedTab === 'service-accounts'">
            <ServiceAccounts />
          </div>

          <!-- Ingest VMs Tab -->
          <div v-else-if="selectedTab === 'ingest-vms'">
            <IngestVMs />
          </div>

          <!-- Generate Users Tab -->
          <div v-else-if="selectedTab === 'generate-users'">
            <GenerateUsers />
          </div>

          <!-- Manage Lockouts Tab -->
          <div v-else-if="selectedTab === 'manage-lockouts'">
            <ManageLockouts />
          </div>

          <!-- Default/Empty State -->
          <div v-else class="text-center py-12">
            <div class="text-gray-400 text-lg mb-4">Select a section from the sidebar</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import Providers from './Providers.vue'
import Users from './Users.vue'
import Workshops from './Workshops.vue'
import Teams from './Teams.vue'
import VMObjects from './VMObjects.vue'
import ServiceAccounts from './ServiceAccounts.vue'
import IngestVMs from './IngestVMs.vue'
import GenerateUsers from './GenerateUsers.vue'
import ManageLockouts from './ManageLockouts.vue'

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
    LockIcon,
    Providers,
    Users,
    Workshops,
    Teams,
    VMObjects,
    ServiceAccounts,
    IngestVMs,
    GenerateUsers,
    ManageLockouts
  },
  setup() {
    const loading = ref(false)
    const error = ref(null)
    const selectedTab = ref('providers')

    const navigationItems = [
      // User Management
      { id: 'users', name: 'Users', icon: 'UserIcon', section: 'User Management' },
      { id: 'generate-users', name: 'Generate Users', icon: 'GenerateIcon', section: 'User Management' },
      
      // Workshop Management
      { id: 'workshops', name: 'Workshops', icon: 'CompetitionIcon', section: 'Workshop Management' },
      { id: 'teams', name: 'Teams', icon: 'TeamIcon', section: 'Workshop Management' },
      
      // Infrastructure
      { id: 'vm-objects', name: 'VM Objects', icon: 'VMIcon', section: 'Infrastructure' },
      { id: 'providers', name: 'Providers', icon: 'ProviderIcon', section: 'Infrastructure' },
      { id: 'ingest-vms', name: 'Ingest VMs', icon: 'ImportIcon', section: 'Infrastructure' },
      
      // System
      { id: 'service-accounts', name: 'Service Accounts', icon: 'ServiceAccountIcon', section: 'System' },
      { id: 'manage-lockouts', name: 'Manage Lockouts', icon: 'LockIcon', section: 'System' }
    ]

    const showAddButton = computed(() => {
      return ['users', 'workshops', 'teams', 'vm-objects', 'providers', 'service-accounts'].includes(selectedTab.value)
    })

    const navigationSections = computed(() => {
      const sections = {}
      
      navigationItems.forEach(item => {
        if (!sections[item.section]) {
          sections[item.section] = {
            name: item.section,
            items: []
          }
        }
        sections[item.section].items.push(item)
      })
      
      return Object.values(sections)
    })

    const getCurrentTabName = () => {
      const item = navigationItems.find(item => item.id === selectedTab.value)
      return item ? item.name : ''
    }

    const selectTab = (tabId) => {
      selectedTab.value = tabId
    }

    const handleAddClick = () => {
      // This will be handled by the individual components
      console.log('Add clicked for:', selectedTab.value)
    }

    const loadData = async () => {
      loading.value = true
      error.value = null
      
      try {
        // Data loading will be handled by individual components
        // This is just for the main admin state
      } catch (err) {
        console.error('Error loading admin data:', err)
        error.value = 'Failed to load data. Please try again.'
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      loadData()
    })

    return {
      loading,
      error,
      selectedTab,
      navigationItems,
      navigationSections,
      showAddButton,
      getCurrentTabName,
      selectTab,
      handleAddClick,
      loadData
    }
  }
}
</script>

<style scoped>
/* Additional styles if needed */
</style>