<template>
  <div class="dhcp-server-view">
    <div class="page-header">
      <h2>DHCP Server</h2>
    </div>

    <el-tabs v-model="activeTab">
      <!-- DHCP Server Tab -->
      <el-tab-pane label="DHCP" name="dhcp">
        <div class="tab-header">
          <el-button type="primary" size="small" @click="showServerDialog()">
            <el-icon><Plus /></el-icon> 新增
          </el-button>
        </div>
        <el-table :data="servers" v-loading="loadingServers" stripe>
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="interface" label="接口" min-width="100" />
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="!toBool(row.disabled)"
                @change="(val: string | number | boolean) => toggleServerStatus(row, Boolean(val))"
              />
            </template>
          </el-table-column>
          <el-table-column prop="address-pool" label="地址池" min-width="120" />
          <el-table-column prop="lease-time" label="租约时间" width="100" />
          <el-table-column prop="comment" label="备注" min-width="100" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="showServerDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteServer(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Networks Tab -->
      <el-tab-pane label="Networks" name="networks">
        <div class="tab-header">
          <el-button type="primary" size="small" @click="showNetworkDialog()">
            <el-icon><Plus /></el-icon> 新增
          </el-button>
        </div>
        <el-table :data="networks" v-loading="loadingNetworks" stripe>
          <el-table-column prop="address" label="网络地址" min-width="140" />
          <el-table-column prop="gateway" label="网关" min-width="120" />
          <el-table-column prop="dns-server" label="DNS 服务器" min-width="140" />
          <el-table-column prop="domain" label="域名" min-width="100" />
          <el-table-column prop="comment" label="备注" min-width="100" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="showNetworkDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteNetwork(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Leases Tab -->
      <el-tab-pane label="Leases" name="leases">
        <div class="tab-header">
          <el-button type="primary" size="small" @click="showLeaseDialog()">
            <el-icon><Plus /></el-icon> 新增静态绑定
          </el-button>
          <el-button size="small" @click="fetchLeases">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
        <el-table :data="leases" v-loading="loadingLeases" stripe>
          <el-table-column prop="address" label="IP 地址" min-width="120" />
          <el-table-column prop="mac-address" label="MAC 地址" min-width="140" />
          <el-table-column prop="host-name" label="主机名" min-width="120" />
          <el-table-column prop="server" label="服务器" width="100" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              {{ toBool(row.dynamic) ? '动态' : '静态' }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80" />
          <el-table-column prop="comment" label="备注" min-width="80" show-overflow-tooltip />
          <el-table-column label="操作" width="220" fixed="right" align="center">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button size="small" @click="showLeaseDialog(row)">编辑</el-button>
                <el-button v-if="toBool(row.dynamic)" size="small" type="warning" @click="makeStatic(row)">转静态</el-button>
                <el-button size="small" type="danger" @click="deleteLease(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- Server Dialog -->
    <el-dialog v-model="serverDialogVisible" :title="serverIsEdit ? '编辑 DHCP Server' : '新增 DHCP Server'" width="500px">
      <el-form :model="serverForm" label-width="120px">
        <el-form-item label="名称" required>
          <el-input v-model="serverForm.name" />
        </el-form-item>
        <el-form-item label="接口" required>
          <el-input v-model="serverForm.interface" />
        </el-form-item>
        <el-form-item label="地址池">
          <el-input v-model="serverForm['address-pool']" placeholder="如: dhcp-pool01" />
        </el-form-item>
        <el-form-item label="租约时间">
          <el-input v-model="serverForm['lease-time']" placeholder="如: 00:10:00" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="serverForm.comment" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serverDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveServer" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- Network Dialog -->
    <el-dialog v-model="networkDialogVisible" :title="networkIsEdit ? '编辑 Network' : '新增 Network'" width="500px">
      <el-form :model="networkForm" label-width="120px">
        <el-form-item label="网络地址" required>
          <el-input v-model="networkForm.address" placeholder="如: 192.168.1.0/24" />
        </el-form-item>
        <el-form-item label="网关">
          <el-input v-model="networkForm.gateway" placeholder="如: 192.168.1.1" />
        </el-form-item>
        <el-form-item label="DNS 服务器">
          <el-input v-model="networkForm['dns-server']" placeholder="如: 8.8.8.8,8.8.4.4" />
        </el-form-item>
        <el-form-item label="域名">
          <el-input v-model="networkForm.domain" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="networkForm.comment" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="networkDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNetwork" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- Lease Dialog -->
    <el-dialog v-model="leaseDialogVisible" :title="leaseIsEdit ? '编辑 Lease' : '新增静态绑定'" width="500px">
      <el-form :model="leaseForm" label-width="120px">
        <el-form-item label="IP 地址" required>
          <el-input v-model="leaseForm.address" placeholder="如: 192.168.1.100" />
        </el-form-item>
        <el-form-item label="MAC 地址" required>
          <el-input v-model="leaseForm['mac-address']" placeholder="如: AA:BB:CC:DD:EE:FF" />
        </el-form-item>
        <el-form-item label="服务器">
          <el-select v-model="leaseForm.server" placeholder="自动选择" clearable style="width: 100%">
            <el-option
              v-for="server in servers"
              :key="server['.id']"
              :label="server.name"
              :value="server.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="leaseForm.comment" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="leaseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLease" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ipApi } from '@/api'

const activeTab = ref('dhcp')
const saving = ref(false)

// Data
const servers = ref<any[]>([])
const networks = ref<any[]>([])
const leases = ref<any[]>([])
const loadingServers = ref(false)
const loadingNetworks = ref(false)
const loadingLeases = ref(false)

// Server Dialog
const serverDialogVisible = ref(false)
const serverIsEdit = ref(false)
const serverEditingId = ref('')
const serverForm = ref({ name: '', interface: '', 'address-pool': '', 'lease-time': '00:10:00', comment: '' })

// Network Dialog
const networkDialogVisible = ref(false)
const networkIsEdit = ref(false)
const networkEditingId = ref('')
const networkForm = ref({ address: '', gateway: '', 'dns-server': '', domain: '', comment: '' })

// Lease Dialog
const leaseDialogVisible = ref(false)
const leaseIsEdit = ref(false)
const leaseEditingId = ref('')
const leaseForm = ref({ address: '', 'mac-address': '', server: '', comment: '' })

const toBool = (val: any): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Fetch functions
const fetchServers = async () => {
  loadingServers.value = true
  try {
    const result = await ipApi.getDhcpServers()
    if (result.data.success && Array.isArray(result.data.data)) {
      servers.value = result.data.data
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取 DHCP Server 失败')
  } finally {
    loadingServers.value = false
  }
}

const fetchNetworks = async () => {
  loadingNetworks.value = true
  try {
    const result = await ipApi.getDhcpNetworks()
    if (result.data.success && Array.isArray(result.data.data)) {
      networks.value = result.data.data
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取 Networks 失败')
  } finally {
    loadingNetworks.value = false
  }
}

const fetchLeases = async () => {
  loadingLeases.value = true
  try {
    const result = await ipApi.getDhcpLeases()
    if (result.data.success && Array.isArray(result.data.data)) {
      leases.value = result.data.data
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取 Leases 失败')
  } finally {
    loadingLeases.value = false
  }
}

// Server functions
const showServerDialog = (row?: any) => {
  serverIsEdit.value = !!row
  serverEditingId.value = row?.['.id'] || ''
  serverForm.value = {
    name: row?.name || '',
    interface: row?.interface || '',
    'address-pool': row?.['address-pool'] || '',
    'lease-time': row?.['lease-time'] || '00:10:00',
    comment: row?.comment || ''
  }
  serverDialogVisible.value = true
}

const saveServer = async () => {
  if (!serverForm.value.name || !serverForm.value.interface) {
    ElMessage.warning('请填写名称和接口')
    return
  }
  saving.value = true
  try {
    if (serverIsEdit.value) {
      await ipApi.updateDhcpServer(serverEditingId.value, serverForm.value)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addDhcpServer(serverForm.value)
      ElMessage.success('添加成功')
    }
    serverDialogVisible.value = false
    fetchServers()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    saving.value = false
  }
}

const toggleServerStatus = async (row: any, enabled: boolean) => {
  try {
    if (enabled) {
      await ipApi.enableDhcpServer(row['.id'])
    } else {
      await ipApi.disableDhcpServer(row['.id'])
    }
    ElMessage.success(enabled ? '已启用' : '已禁用')
    fetchServers()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const deleteServer = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 DHCP Server 吗？', '确认删除', { type: 'warning' })
    await ipApi.deleteDhcpServer(row['.id'])
    ElMessage.success('删除成功')
    fetchServers()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

// Network functions
const showNetworkDialog = (row?: any) => {
  networkIsEdit.value = !!row
  networkEditingId.value = row?.['.id'] || ''
  networkForm.value = {
    address: row?.address || '',
    gateway: row?.gateway || '',
    'dns-server': row?.['dns-server'] || '',
    domain: row?.domain || '',
    comment: row?.comment || ''
  }
  networkDialogVisible.value = true
}

const saveNetwork = async () => {
  if (!networkForm.value.address) {
    ElMessage.warning('请填写网络地址')
    return
  }
  saving.value = true
  try {
    if (networkIsEdit.value) {
      await ipApi.updateDhcpNetwork(networkEditingId.value, networkForm.value)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addDhcpNetwork(networkForm.value)
      ElMessage.success('添加成功')
    }
    networkDialogVisible.value = false
    fetchNetworks()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    saving.value = false
  }
}

const deleteNetwork = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 Network 吗？', '确认删除', { type: 'warning' })
    await ipApi.deleteDhcpNetwork(row['.id'])
    ElMessage.success('删除成功')
    fetchNetworks()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

// Lease functions
const showLeaseDialog = async (row?: any) => {
  // 确保 servers 数据已加载，用于服务器下拉选择
  if (servers.value.length === 0) {
    await fetchServers()
  }
  leaseIsEdit.value = !!row
  leaseEditingId.value = row?.['.id'] || ''
  leaseForm.value = {
    address: row?.address || '',
    'mac-address': row?.['mac-address'] || '',
    server: row?.server || '',
    comment: row?.comment || ''
  }
  leaseDialogVisible.value = true
}

const saveLease = async () => {
  if (!leaseForm.value.address || !leaseForm.value['mac-address']) {
    ElMessage.warning('请填写 IP 地址和 MAC 地址')
    return
  }
  saving.value = true
  try {
    if (leaseIsEdit.value) {
      await ipApi.updateDhcpLease(leaseEditingId.value, leaseForm.value)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addDhcpLease(leaseForm.value)
      ElMessage.success('添加成功')
    }
    leaseDialogVisible.value = false
    fetchLeases()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    saving.value = false
  }
}

const makeStatic = async (row: any) => {
  try {
    await ipApi.makeDhcpLeaseStatic(row['.id'])
    ElMessage.success('已转为静态绑定')
    fetchLeases()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const deleteLease = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 Lease 吗？', '确认删除', { type: 'warning' })
    await ipApi.deleteDhcpLease(row['.id'])
    ElMessage.success('删除成功')
    fetchLeases()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

watch(activeTab, (tab) => {
  if (tab === 'dhcp') fetchServers()
  else if (tab === 'networks') fetchNetworks()
  else if (tab === 'leases') fetchLeases()
})

onMounted(() => {
  fetchServers()
})
</script>

<style scoped>
.dhcp-server-view { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.tab-header { margin-bottom: 15px; display: flex; gap: 10px; }
.action-buttons { display: flex; gap: 4px; justify-content: center; flex-wrap: nowrap; }
</style>
