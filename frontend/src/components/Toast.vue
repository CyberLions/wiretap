<template>
  <div
    v-if="show"
    class="fixed top-4 right-4 z-50 max-w-sm w-full"
    :class="type === 'success' ? 'bg-green-600' : 'bg-red-600'"
  >
    <div class="flex items-center p-4 text-white">
      <div class="flex-shrink-0">
        <CheckCircleIcon v-if="type === 'success'" class="w-5 h-5" />
        <XCircleIcon v-else class="w-5 h-5" />
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium">{{ message }}</p>
      </div>
      <div class="ml-auto pl-3">
        <button
          @click="$emit('close')"
          class="inline-flex text-white focus:outline-none focus:text-white"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'

export default {
  name: 'Toast',
  components: {
    CheckCircleIcon,
    XCircleIcon,
    XMarkIcon
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'success',
      validator: (value) => ['success', 'error'].includes(value)
    }
  },
  emits: ['close']
}
</script> 