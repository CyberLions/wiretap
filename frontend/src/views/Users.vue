<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Users</h1>
        <button class="btn btn-primary" @click="createUser">Create User</button>
      </div>
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="spinner w-8 h-8"></div>
        <span class="ml-3 text-gray-400">Loading users...</span>
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
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Auth Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="user in users" :key="user.id" class="table-row">
                <td class="table-cell">{{ user.first_name }} {{ user.last_name }}</td>
                <td class="table-cell">{{ user.username }}</td>
                <td class="table-cell">{{ user.email }}</td>
                <td class="table-cell">
                  <span :class="['status-badge text-xs', user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800']">
                    {{ user.role }}
                  </span>
                </td>
                <td class="table-cell">
                  <span :class="['status-badge text-xs', user.auth_type === 'OPENID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800']">
                    {{ user.auth_type }}
                  </span>
                </td>
                <td class="table-cell">
                  <div class="flex space-x-2">
                    <button class="btn btn-secondary text-xs" @click="editUser(user.id)">Edit</button>
                    <button class="btn btn-danger text-xs" @click="deleteUser(user.id)">Delete</button>
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
  name: 'Users',
  setup() {
    const users = ref([])
    const loading = ref(true)
    const error = ref(null)

    const fetchUsers = async () => {
      try {
        loading.value = true
        error.value = null
        const response = await api.get('/users')
        users.value = response.data
      } catch (err) {
        error.value = err.response?.data?.message || 'Failed to load users'
      } finally {
        loading.value = false
      }
    }

    const createUser = () => {
      // TODO: Show create user modal
      alert('Create user modal not implemented')
    }
    const editUser = (id) => {
      // TODO: Show edit user modal
      alert('Edit user modal not implemented')
    }
    const deleteUser = async (id) => {
      if (!confirm('Are you sure you want to delete this user?')) return
      try {
        await api.delete(`/users/${id}`)
        await fetchUsers()
      } catch (err) {
        alert('Failed to delete user')
      }
    }
    onMounted(() => {
      fetchUsers()
    })
    return { users, loading, error, createUser, editUser, deleteUser }
  }
}
</script>