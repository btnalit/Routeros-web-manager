import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Device {
  id: string
  name: string
  host: string
  port: number
  username: string
  useTLS: boolean
}

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const selectedDeviceId = ref<string | null>(localStorage.getItem('selectedDeviceId'))
  const loading = ref(false)

  const selectedDevice = computed(() => {
    return devices.value.find(d => d.id === selectedDeviceId.value) || null
  })

  function setDevices(newDevices: Device[]) {
    devices.value = newDevices
    // If we have devices but none selected, select the first one
    if (devices.value.length > 0 && !selectedDeviceId.value) {
      selectDevice(devices.value[0].id)
    }
    // If selected device no longer exists, clear selection or select first
    if (selectedDeviceId.value && !devices.value.find(d => d.id === selectedDeviceId.value)) {
       if (devices.value.length > 0) {
         selectDevice(devices.value[0].id)
       } else {
         selectedDeviceId.value = null
         localStorage.removeItem('selectedDeviceId')
       }
    }
  }

  function selectDevice(id: string) {
    selectedDeviceId.value = id
    localStorage.setItem('selectedDeviceId', id)
  }

  function clearSelection() {
    selectedDeviceId.value = null
    localStorage.removeItem('selectedDeviceId')
  }

  return {
    devices,
    selectedDeviceId,
    selectedDevice,
    loading,
    setDevices,
    selectDevice,
    clearSelection
  }
})
