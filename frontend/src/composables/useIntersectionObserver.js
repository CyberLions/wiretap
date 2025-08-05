import { ref, onMounted, onUnmounted } from 'vue'

export function useIntersectionObserver(options = {}) {
  const isVisible = ref(false)
  const elementRef = ref(null)
  
  const defaultOptions = {
    threshold: 0.1,
    rootMargin: '0px',
    ...options
  }
  
  let observer = null
  
  const startObserving = () => {
    if (!elementRef.value) return
    
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true
          // Once visible, we can stop observing
          observer.unobserve(entry.target)
        }
      })
    }, defaultOptions)
    
    observer.observe(elementRef.value)
  }
  
  const stopObserving = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }
  
  onMounted(() => {
    startObserving()
  })
  
  onUnmounted(() => {
    stopObserving()
  })
  
  return {
    isVisible,
    elementRef
  }
} 