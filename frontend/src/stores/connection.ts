import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface RouterOSConfig {
  host: string
  port: number
  username: string
  password: string
  useTLS: boolean
}

export const useConnectionStore = defineStore('connection', () => {
  const isConnected = ref(false)
  const config = ref<RouterOSConfig | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function setConnected(connected: boolean) {
    isConnected.value = connected
  }

  function setConfig(newConfig: RouterOSConfig | null) {
    config.value = newConfig
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  return {
    isConnected,
    config,
    loading,
    error,
    setConnected,
    setConfig,
    setLoading,
    setError
  }
})
