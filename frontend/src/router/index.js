// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

// Import views
import Login from '@/views/Login.vue'
import Dashboard from '@/views/Dashboard.vue'
import Workshops from '@/views/Workshops.vue'
import WorkshopDetail from '@/views/WorkshopDetail.vue'
import Teams from '@/views/Teams.vue'
import TeamDetail from '@/views/TeamDetail.vue'
import Instances from '@/views/Instances.vue'
import InstanceDetail from '@/views/InstanceDetail.vue'
import Console from '@/views/Console.vue'
import Admin from '@/views/Admin.vue'
import Users from '@/views/Users.vue'
import Providers from '@/views/Providers.vue'
import Loading from '@/views/Loading.vue'
import Logs from '@/views/Logs.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { 
      hideHeader: true,
      public: true 
    }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: Loading,
    meta: { 
      hideHeader: true,
      public: true 
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/workshops',
    name: 'Workshops',
    component: Workshops,
    meta: { requiresAuth: true }
  },
  {
    path: '/workshops/:id',
    name: 'WorkshopDetail',
    component: WorkshopDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/teams',
    name: 'Teams',
    component: Teams,
    meta: { requiresAuth: true }
  },
  {
    path: '/teams/:id',
    name: 'TeamDetail',
    component: TeamDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/instances',
    name: 'Instances',
    component: Instances,
    meta: { requiresAuth: true }
  },
  {
    path: '/instances/:id',
    name: 'InstanceDetail',
    component: InstanceDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/console/:id',
    name: 'Console',
    component: Console,
    meta: { 
      requiresAuth: true,
      hideHeader: true
    }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: Admin,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/providers',
    name: 'Providers',
    component: Providers,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/logs',
    name: 'Logs',
    component: Logs,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isAdmin, getCurrentUser } = useAuth()
  
  // Check if route is public
  if (to.meta.public) {
    next()
    return
  }
  
  // If we have a token but no user data, try to fetch it
  const token = localStorage.getItem('wiretap_token')
  if (token && !isAuthenticated.value) {
    try {
      await getCurrentUser()
    } catch (error) {
      next('/login')
      return
    }
  }
  
  // Check if user is authenticated
  if (!isAuthenticated.value) {
    next('/login')
    return
  }
  
  // Check admin requirements
  if (to.meta.requiresAdmin && !isAdmin.value) {
    next('/dashboard')
    return
  }
  
  next()
})

export default router
