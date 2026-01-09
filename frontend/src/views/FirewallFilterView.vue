<template>
  <div class="firewall-filter-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>防火墙 Filter 规则</span>
          <div class="header-actions">
            <el-select
              v-model="chainFilter"
              placeholder="按 Chain 筛选"
              clearable
              style="width: 150px; margin-right: 8px"
              @change="handleChainFilter"
            >
              <el-option label="input" value="input" />
              <el-option label="forward" value="forward" />
              <el-option label="output" value="output" />
            </el-select>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadFilterRules"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && rules.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Filter Rules Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="filteredRules"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="chain" label="Chain" width="100" sortable />
        <el-table-column prop="action" label="Action" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)" size="small">
              {{ row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="src-address" label="源地址" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['src-address'] || row['src-address-list'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="dst-address" label="目标地址" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['dst-address'] || row['dst-address-list'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="80">
          <template #default="{ row }">
            {{ row.protocol || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="端口" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getPortDisplay(row) }}
          </template>
        </el-table-column>
        <el-table-column label="接口" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['in-interface'] || row['out-interface'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? '禁用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              @click.stop="showDetail(row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="Filter 规则详情"
      width="600px"
      destroy-on-close
    >
      <el-descriptions :column="2" border v-if="selectedRule">
        <el-descriptions-item label="ID">{{ selectedRule['.id'] }}</el-descriptions-item>
        <el-descriptions-item label="Chain">{{ selectedRule.chain }}</el-descriptions-item>
        <el-descriptions-item label="Action">
          <el-tag :type="getActionType(selectedRule.action)" size="small">
            {{ selectedRule.action }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedRule.disabled ? 'danger' : 'success'" size="small">
            {{ selectedRule.disabled ? '禁用' : '启用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="源地址">{{ selectedRule['src-address'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标地址">{{ selectedRule['dst-address'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="源地址列表">{{ selectedRule['src-address-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标地址列表">{{ selectedRule['dst-address-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="协议">{{ selectedRule.protocol || '-' }}</el-descriptions-item>
        <el-descriptions-item label="源端口">{{ selectedRule['src-port'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标端口">{{ selectedRule['dst-port'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入接口">{{ selectedRule['in-interface'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="出接口">{{ selectedRule['out-interface'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="连接状态">{{ selectedRule['connection-state'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="动态规则">{{ selectedRule.dynamic ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="字节数">{{ formatBytes(selectedRule.bytes) }}</el-descriptions-item>
        <el-descriptions-item label="数据包数">{{ selectedRule.packets || 0 }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedRule.comment || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { firewallApi } from '@/api'

// Filter Rule type definition
interface FilterRule {
  '.id': string
  chain: string
  action: string
  'src-address'?: string
  'dst-address'?: string
  'src-address-list'?: string
  'dst-address-list'?: string
  protocol?: string
  'src-port'?: string
  'dst-port'?: string
  'in-interface'?: string
  'out-interface'?: string
  'connection-state'?: string
  disabled: boolean
  dynamic: boolean
  comment?: string
  bytes?: number
  packets?: number
}

// State
const loading = ref(false)
const error = ref('')
const rules = ref<FilterRule[]>([])
const chainFilter = ref('')
const detailVisible = ref(false)
const selectedRule = ref<FilterRule | null>(null)

// Computed filtered rules
const filteredRules = computed(() => {
  if (!chainFilter.value) {
    return rules.value
  }
  return rules.value.filter(rule => rule.chain === chainFilter.value)
})

// Load filter rules on mount
onMounted(() => {
  loadFilterRules()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all filter rules
const loadFilterRules = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await firewallApi.getFilters()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      rules.value = result.data.map((rule: FilterRule) => ({
        ...rule,
        disabled: toBool(rule.disabled),
        dynamic: toBool(rule.dynamic)
      }))
    } else {
      rules.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 Filter 规则列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle chain filter change
const handleChainFilter = () => {
  // Filter is computed, no need to reload
}

// Handle row click
const handleRowClick = (row: FilterRule) => {
  showDetail(row)
}

// Show rule detail
const showDetail = (row: FilterRule) => {
  selectedRule.value = row
  detailVisible.value = true
}

// Get action tag type
const getActionType = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'primary' => {
  switch (action) {
    case 'accept':
      return 'success'
    case 'drop':
      return 'danger'
    case 'reject':
      return 'warning'
    case 'jump':
    case 'return':
      return 'info'
    default:
      return 'primary'
  }
}

// Get port display
const getPortDisplay = (row: FilterRule) => {
  const srcPort = row['src-port']
  const dstPort = row['dst-port']
  if (srcPort && dstPort) {
    return `${srcPort} → ${dstPort}`
  }
  if (dstPort) {
    return `→ ${dstPort}`
  }
  if (srcPort) {
    return `${srcPort} →`
  }
  return '-'
}

// Format bytes
const formatBytes = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.firewall-filter-view {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
