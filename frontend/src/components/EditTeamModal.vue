<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop">
    <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">Edit Team</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter team name"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Team Number</label>
          <input
            v-model="form.team_number"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter team number"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Competition</label>
          <select
            v-model="form.workshop_id"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a competition</option>
            <option v-for="competition in competitions" :key="competition.id" :value="competition.id">
              {{ competition.name }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter team description (optional)"
          ></textarea>
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
            <span v-if="loading">Updating...</span>
            <span v-else>Update Team</span>
          </button>
        </div>
      </form>
    </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, watch } from 'vue'
import api from '@/services/api'

export default {
  name: 'EditTeamModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    team: {
      type: Object,
      default: null
    },
    competitions: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'updated', 'error'],
  setup(props, { emit }) {
    const loading = ref(false)
    const form = ref({
      name: '',
      team_number: '',
      workshop_id: '',
      description: ''
    })

    const resetForm = () => {
      form.value = {
        name: '',
        team_number: '',
        workshop_id: '',
        description: ''
      }
    }

    const populateForm = (team) => {
      if (team) {
        form.value = {
          name: team.name || '',
          team_number: team.team_number || team.number || '',
          workshop_id: team.workshop_id || team.workshop?.id || '',
          description: team.description || ''
        }
      }
    }

    const handleSubmit = async () => {
      if (!props.team?.id) return
      
      loading.value = true
      try {
        await api.teams.update(props.team.id, form.value)
        emit('updated')
        emit('close')
      } catch (error) {
        console.error('Error updating team:', error)
        // Emit error event for parent to handle
        emit('error', error.response?.data?.error || 'Failed to update team')
      } finally {
        loading.value = false
      }
    }

    // Populate form when team changes
    watch(() => props.team, (newTeam) => {
      if (newTeam) {
        populateForm(newTeam)
      }
    }, { immediate: true })

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