<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop">
    <div class="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">Generated Users</h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-white"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        <div class="mb-4">
          <div class="bg-green-900 border border-green-700 rounded-lg p-4 mb-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-green-400 font-medium">{{ message }}</span>
            </div>
          </div>
        </div>
        
        <div class="space-y-4">
          <div v-for="(team, teamIndex) in teams" :key="team.id" class="bg-gray-700 rounded-lg p-4">
            <h4 class="text-lg font-medium text-white mb-3">{{ team.name }}</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-600">
                    <th class="text-left py-2 text-gray-300">Username</th>
                    <th class="text-left py-2 text-gray-300">Password</th>
                    <th class="text-left py-2 text-gray-300">Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="user in getUsersForTeam(team.id)" 
                    :key="user.id" 
                    class="border-b border-gray-600"
                  >
                    <td class="py-2 text-white">{{ user.username }}</td>
                    <td class="py-2">
                      <div class="flex items-center space-x-2">
                        <span class="font-mono text-green-400">{{ user.password }}</span>
                        <button
                          @click="copyToClipboard(user.password)"
                          class="text-blue-400 hover:text-blue-300 text-xs"
                          title="Copy password"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="py-2 text-gray-300">{{ user.email }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end space-x-3">
          <button
            @click="exportToCSV"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Export to CSV
          </button>
          <button
            @click="$emit('close')"
            class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'GeneratedUsersModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    users: {
      type: Array,
      default: () => []
    },
    teams: {
      type: Array,
      default: () => []
    },
    message: {
      type: String,
      default: ''
    }
  },
  emits: ['close'],
  setup(props) {
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text)
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard:', err)
      }
    }

    const getUsersForTeam = (teamId) => {
      return props.users.filter(user => user.team_id === teamId)
    }

    const exportToCSV = () => {
      const csvContent = [
        'Username,Password,Email,Team',
        ...props.users.map(user => 
          `"${user.username}","${user.password}","${user.email}","${user.team || ''}"`
        )
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'generated_users.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    }

    return {
      copyToClipboard,
      getUsersForTeam,
      exportToCSV
    }
  }
}
</script>
