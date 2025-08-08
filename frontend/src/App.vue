<template>
  <div id="app" class="min-h-screen bg-gray-900">
    <!-- Header -->
    <Header v-if="showHeader" />
    
    <!-- Content -->
    <div class="relative z-10">
      <main :class="mainClass">
        <router-view v-slot="{ Component, route }">
          <transition 
            name="page" 
            mode="out-in"
            @enter="onPageEnter"
            @leave="onPageLeave"
          >
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from '@/components/layout/Header.vue'

export default {
  name: 'App',
  components: {
    Header
  },
  setup() {
    const route = useRoute()
    
    const showHeader = computed(() => {
      return !route.meta?.hideHeader
    })
    
    const mainClass = computed(() => {
      return { 'pt-16': !route.meta?.hideHeader }
    })
    
    const onPageEnter = (el) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(20px)'
      setTimeout(() => {
        el.style.transition = 'all 0.3s ease-in-out'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }, 10)
    }
    
    const onPageLeave = (el) => {
      el.style.transition = 'all 0.3s ease-in-out'
      el.style.opacity = '0'
      el.style.transform = 'translateY(-20px)'
    }
    
    return {
      showHeader,
      mainClass,
      onPageEnter,
      onPageLeave
    }
  }
}
</script>

<style>
/* Global styles */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1f2937;
}

::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Page transition animations */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease-in-out;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Custom focus styles */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900;
}

/* Button styles */
.btn {
  @apply px-4 py-2 rounded-md font-medium transition-colors duration-200 focus-ring;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500;
}

.btn-secondary {
  @apply bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700 focus:ring-red-500;
}

.btn-success {
  @apply bg-green-600 text-white hover:bg-green-700 focus:ring-green-500;
}

/* Card styles */
.card {
  @apply bg-gray-800 rounded-lg shadow-lg border border-gray-700;
}

.card-header {
  @apply px-6 py-4 border-b border-gray-700;
}

.card-body {
  @apply px-6 py-4;
}

.card-footer {
  @apply px-6 py-4 border-t border-gray-700;
}

/* Form styles */
.form-input {
  @apply block w-full rounded-md border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus-ring;
}

.form-label {
  @apply block text-sm font-medium text-gray-300 mb-2;
}

.form-error {
  @apply text-red-400 text-sm mt-1;
}

/* Table styles */
.table {
  @apply min-w-full divide-y divide-gray-700;
}

.table-header {
  @apply bg-gray-800;
}

.table-header th {
  @apply px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider;
}

.table-body {
  @apply bg-gray-900 divide-y divide-gray-700;
}

.table-row {
  @apply hover:bg-gray-800 transition-colors duration-200;
}

.table-cell {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-300;
}

/* Status badges */
.status-badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.status-active {
  @apply bg-green-100 text-green-800;
}

.status-inactive {
  @apply bg-red-100 text-red-800;
}

.status-pending {
  @apply bg-yellow-100 text-yellow-800;
}

/* Loading spinner */
.spinner {
  @apply animate-spin rounded-full border-2 border-gray-300 border-t-blue-600;
}
</style>
