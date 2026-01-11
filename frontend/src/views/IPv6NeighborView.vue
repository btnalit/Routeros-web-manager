<template>
  <div class="ipv6-neighbor-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IPv6 邻居表</span>
          <div class="header-actions">
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadNeighbors"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && neighbors.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Empty State -->
      <el-empty
        v-else-if="neighbors.length === 0"
        description="暂无 IPv6 邻居数据"
      />

      <!-- IPv6 Neighbor Table with Pagination -->
      <template v-else>
        <el-table
          v-loading="loading"
          :data="paginatedNeighbors"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="address" label="IPv6 地址" min-width="280" sortable show-overflow-tooltip />
          <el-table-column prop="interface" label="接口" min-width="120" sortable />
          <el-table-column prop="mac-address" label="MAC 地址" min-width="150">
            <template #default="{ row }">
              {{ row['mac-address'] || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="bridge-port" label="Bridge 端口" min-width="120">
            <template #default="{ row }">
              {{ row['bridge-port'] || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="host-name" label="主机名" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row['host-name'] || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.dynamic ? 'info' : 'primary'" size="small">
                {{ row.dynamic ? '动态' : '静态' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- Pagination -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="neighbors.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { ipv6Api } from '@/api'

// IPv6 Neighbor type definition
interface IPv6Neighbor {
  '.id': string
  address: string
  interface: string
  'mac-address': string
  status: string
  'bridge-port'?: string
  'host-name'?: string
  dynamic?: boolean
  comment?: string
}

// State
const loading = ref(false)
const error = ref('')
const neighbors = ref<IPv6Neighbor[]>([])

// Pagination state
const currentPage = ref(1)
const pageSize = ref(20)

// Computed paginated data
const paginatedNeighbors = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return neighbors.value.slice(start, end)
})

// Pagination handlers
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

// Load neighbors on mount
onMounted(() => {
  loadNeighbors()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Tag type for Element Plus
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

// Get status tag type based on neighbor status
const getStatusTagType = (status: string): TagType => {
  switch (status?.toLowerCase()) {
    case 'reachable':
      return 'success'
    case 'stale':
      return 'warning'
    case 'delay':
    case 'probe':
      return 'info'
    case 'incomplete':
    case 'noarp':
      return 'danger'
    default:
      return 'info'
  }
}

// Get human-readable status label
const getStatusLabel = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'reachable':
      return '可达'
    case 'stale':
      return '过期'
    case 'delay':
      return '延迟'
    case 'probe':
      return '探测'
    case 'incomplete':
      return '不完整'
    case 'noarp':
      return '无 ARP'
    default:
      return status || '-'
  }
}

// Load all IPv6 neighbors
const loadNeighbors = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getNeighbors()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      neighbors.value = result.data.map((neighbor: IPv6Neighbor) => ({
        ...neighbor,
        dynamic: toBool(neighbor.dynamic)
      }))
    } else {
      neighbors.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 IPv6 邻居表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ipv6-neighbor-view {
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
  gap: 8px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
