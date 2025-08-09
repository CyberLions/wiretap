import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wiretap_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors with one-time refresh attempt
let isRefreshing = false
let pendingRequestsQueue = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status
    const isAuthRefreshCall = originalRequest?.url?.includes('/auth/refresh')
    const isAuthLoginCall = originalRequest?.url?.includes('/auth/login')
    const hasToken = !!localStorage.getItem('wiretap_token')

    // If unauthorized, try refresh once
    if (status === 401 && !originalRequest._retry && !isAuthRefreshCall && !isAuthLoginCall && hasToken) {
      originalRequest._retry = true

      // Queue the request while refreshing
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequestsQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      isRefreshing = true
      try {
        const refreshResponse = await api.post('/auth/refresh')
        const newToken = refreshResponse.data.token
        if (newToken) {
          localStorage.setItem('wiretap_token', newToken)
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          pendingRequestsQueue.forEach(({ resolve }) => resolve(newToken))
          pendingRequestsQueue = []
          isRefreshing = false
          // Retry original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        pendingRequestsQueue.forEach(({ reject }) => reject(refreshError))
        pendingRequestsQueue = []
        isRefreshing = false
      }
    }

    // On failure or if not 401, clean up and redirect if unauthorized
    if (status === 401) {
      localStorage.removeItem('wiretap_token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

// API methods
const setToken = (token) => {
  if (token) {
    localStorage.setItem('wiretap_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
}

const clearToken = () => {
  localStorage.removeItem('wiretap_token')
  delete api.defaults.headers.common['Authorization']
}

// Authentication
const auth = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh')
}

// Instances (VMs)
const instances = {
  getAll: () => api.get('/instances'),
  getById: (id) => api.get(`/instances/${id}`),
  create: (data) => api.post('/instances', data),
  update: (id, data) => api.put(`/instances/${id}`, data),
  delete: (id) => api.delete(`/instances/${id}`),
  powerOn: (id) => api.post(`/instances/${id}/power-on`),
  powerOff: (id) => api.post(`/instances/${id}/power-off`),
  reboot: (id, type = 'soft') => {
    console.log(`API: Rebooting instance ${id} with type ${type}`)
    return api.post(`/instances/${id}/reboot`, { type })
  },
  getConsole: (id, type = 'vnc') => api.get(`/instances/${id}/console?type=${type}`),
  getStatus: (id) => api.get(`/instances/${id}/status`),
  bulkAssign: (data) => api.post('/instances/bulk-assign', data)
}

// Users
const users = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  generateUsers: (data) => api.post('/users/generate', data),
  changePassword: (id, password) => api.put(`/users/${id}/password`, { password })
}

// Teams
const teams = {
  getAll: () => api.get('/teams'),
  getById: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  getUsers: (id) => api.get(`/teams/${id}/users`),
  addUser: (id, userId) => api.post(`/teams/${id}/users`, { user_id: userId }),
  removeUser: (id, userId) => api.delete(`/teams/${id}/users/${userId}`)
}

// Workshops (Competitions)
const workshops = {
  getAll: () => api.get('/workshops'),
  getById: (id) => api.get(`/workshops/${id}`),
  create: (data) => api.post('/workshops', data),
  update: (id, data) => api.put(`/workshops/${id}`, data),
  delete: (id) => api.delete(`/workshops/${id}`)
}

// Providers
const providers = {
  getAll: () => api.get('/providers'),
  getById: (id) => api.get(`/providers/${id}`),
  create: (data) => api.post('/providers', data),
  update: (id, data) => api.put(`/providers/${id}`, data),
  delete: (id) => api.delete(`/providers/${id}`),
  testConnection: (id) => api.post(`/providers/${id}/test`),
  getProjects: (id) => api.get(`/providers/${id}/projects`),
  getInstances: (id, params = {}) => api.get(`/providers/${id}/instances`, { params }),
  ingestVMs: (id, data) => api.post(`/providers/${id}/ingest`, data)
}

// Admin
const admin = {
  getStats: () => api.get('/admin/stats'),
  getLogs: (params = {}) => api.get('/admin/logs', { params }),
  lockoutVM: (id) => api.post(`/admin/instances/${id}/lockout`),
  unlockVM: (id) => api.post(`/admin/instances/${id}/unlock`),
  getServiceAccounts: () => api.get('/admin/service-accounts'),
  createServiceAccount: (data) => api.post('/admin/service-accounts', data),
  deleteServiceAccount: (id) => api.delete(`/admin/service-accounts/${id}`)
}

// VNC Console
const vnc = {
  getSession: (instanceId) => api.get(`/vnc/session/${instanceId}`),
  createSession: (instanceId) => api.post(`/vnc/session/${instanceId}`),
  deleteSession: (instanceId) => api.delete(`/vnc/session/${instanceId}`)
}

// Export methods
export default {
  ...api,
  setToken,
  clearToken,
  auth,
  instances,
  users,
  teams,
  workshops,
  providers,
  admin,
  vnc
} 