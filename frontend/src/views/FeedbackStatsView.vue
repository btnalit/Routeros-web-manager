<template>
  <div class="feedback-stats-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-icon :size="28" color="#67c23a"><DataLine /></el-icon>
        <span class="header-title">反馈统计</span>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadStats">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Overview Cards -->
    <el-row :gutter="16" class="overview-cards">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409eff;">
              <el-icon :size="24"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overviewStats.totalRules }}</div>
              <div class="stat-label">规则总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67c23a;">
              <el-icon :size="24"><CircleCheckFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overviewStats.totalUseful }}</div>
              <div class="stat-label">有用反馈</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f56c6c;">
              <el-icon :size="24"><CircleCloseFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ overviewStats.totalNotUseful }}</div>
              <div class="stat-label">无用反馈</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6a23c;">
              <el-icon :size="24"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ rulesNeedingReview.length }}</div>
              <div class="stat-label">需审查规则</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" class="main-tabs">
      <!-- All Rules Stats Tab -->
      <el-tab-pane label="规则误报率排行" name="ranking">
        <!-- Loading State -->
        <el-skeleton v-if="loading && allStats.length === 0" :rows="5" animated />

        <!-- Error State -->
        <el-alert
          v-else-if="error"
          :title="error"
          type="error"
          show-icon
          closable
          @close="error = ''"
        >
          <template #default>
            <el-button type="primary" size="small" @click="loadStats">
              重新加载
            </el-button>
          </template>
        </el-alert>

        <!-- Empty State -->
        <el-empty v-else-if="allStats.length === 0" description="暂无反馈统计数据" />

        <!-- Stats Table -->
        <el-card v-else shadow="hover">
          <el-table
            v-loading="loading"
            :data="sortedStats"
            stripe
            style="width: 100%"
            :default-sort="{ prop: 'falsePositiveRate', order: 'descending' }"
            @sort-change="handleSortChange"
          >
            <el-table-column prop="ruleId" label="规则 ID" width="200" show-overflow-tooltip />
            <el-table-column prop="totalAlerts" label="告警总数" width="100" sortable="custom" align="center" />
            <el-table-column prop="usefulCount" label="有用" width="80" align="center">
              <template #default="{ row }">
                <span class="useful-count">{{ row.usefulCount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="notUsefulCount" label="无用" width="80" align="center">
              <template #default="{ row }">
                <span class="not-useful-count">{{ row.notUsefulCount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="falsePositiveRate" label="误报率" width="180" sortable="custom">
              <template #default="{ row }">
                <div class="rate-cell">
                  <el-progress
                    :percentage="Math.round(row.falsePositiveRate * 100)"
                    :color="getFalsePositiveColor(row.falsePositiveRate)"
                    :stroke-width="10"
                    style="width: 100px"
                  />
                  <span class="rate-text" :style="{ color: getFalsePositiveColor(row.falsePositiveRate) }">
                    {{ formatPercent(row.falsePositiveRate) }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.falsePositiveRate >= reviewThreshold" type="danger" size="small">
                  需审查
                </el-tag>
                <el-tag v-else-if="row.falsePositiveRate >= 0.15" type="warning" size="small">
                  关注
                </el-tag>
                <el-tag v-else type="success" size="small">
                  正常
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="lastUpdated" label="最后更新" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.lastUpdated) }}
              </template>
            </el-table-column>
          </el-table>

          <!-- Pagination -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50]"
              :total="allStats.length"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- Rules Needing Review Tab -->
      <el-tab-pane name="review">
        <template #label>
          <span>
            需审查规则
            <el-badge v-if="rulesNeedingReview.length > 0" :value="rulesNeedingReview.length" type="danger" class="tab-badge" />
          </span>
        </template>

        <!-- Threshold Setting -->
        <el-card class="threshold-card" shadow="hover">
          <div class="threshold-setting">
            <span class="threshold-label">误报率阈值：</span>
            <el-slider
              v-model="reviewThresholdPercent"
              :min="10"
              :max="80"
              :step="5"
              :format-tooltip="(val: number) => `${val}%`"
              style="width: 200px"
              @change="loadRulesNeedingReview"
            />
            <span class="threshold-value">{{ reviewThresholdPercent }}%</span>
            <el-tooltip content="误报率超过此阈值的规则将被标记为需要审查" placement="top">
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </el-card>

        <!-- Loading State -->
        <el-skeleton v-if="reviewLoading && rulesNeedingReview.length === 0" :rows="3" animated />

        <!-- Empty State -->
        <el-empty v-else-if="rulesNeedingReview.length === 0" description="暂无需要审查的规则">
          <template #description>
            <p>所有规则的误报率都在 {{ reviewThresholdPercent }}% 以下</p>
          </template>
        </el-empty>

        <!-- Review List -->
        <div v-else class="review-list">
          <el-card
            v-for="rule in rulesNeedingReview"
            :key="rule.ruleId"
            class="review-card"
            shadow="hover"
          >
            <div class="review-header">
              <div class="review-title">
                <el-icon color="#f56c6c"><Warning /></el-icon>
                <span class="rule-id">{{ rule.ruleId }}</span>
              </div>
              <el-tag type="danger" size="small">
                误报率 {{ formatPercent(rule.falsePositiveRate) }}
              </el-tag>
            </div>
            <div class="review-body">
              <div class="review-stats">
                <div class="stat-item">
                  <span class="stat-label">告警总数</span>
                  <span class="stat-value">{{ rule.totalAlerts }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">有用反馈</span>
                  <span class="stat-value useful">{{ rule.usefulCount }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">无用反馈</span>
                  <span class="stat-value not-useful">{{ rule.notUsefulCount }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最后更新</span>
                  <span class="stat-value">{{ formatDateTime(rule.lastUpdated) }}</span>
                </div>
              </div>
              <el-progress
                :percentage="Math.round(rule.falsePositiveRate * 100)"
                :color="getFalsePositiveColor(rule.falsePositiveRate)"
                :stroke-width="12"
                class="review-progress"
              />
            </div>
            <div class="review-actions">
              <el-button type="primary" size="small" @click="goToAlertRule(rule.ruleId)">
                <el-icon><View /></el-icon>
                查看规则
              </el-button>
              <el-button size="small" @click="goToAlertEvents(rule.ruleId)">
                <el-icon><List /></el-icon>
                查看告警
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Refresh,
  DataLine,
  Document,
  CircleCheckFilled,
  CircleCloseFilled,
  Warning,
  QuestionFilled,
  View,
  List
} from '@element-plus/icons-vue'
import { feedbackApi, type FeedbackStats } from '@/api/ai-ops'

const router = useRouter()

// State
const loading = ref(false)
const reviewLoading = ref(false)
const error = ref('')
const allStats = ref<FeedbackStats[]>([])
const rulesNeedingReview = ref<FeedbackStats[]>([])
const activeTab = ref('ranking')
const reviewThresholdPercent = ref(30)

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Sort state
const sortProp = ref('falsePositiveRate')
const sortOrder = ref<'ascending' | 'descending'>('descending')

// Computed
const reviewThreshold = computed(() => reviewThresholdPercent.value / 100)

const overviewStats = computed(() => {
  const totalRules = allStats.value.length
  const totalUseful = allStats.value.reduce((sum, s) => sum + s.usefulCount, 0)
  const totalNotUseful = allStats.value.reduce((sum, s) => sum + s.notUsefulCount, 0)
  return { totalRules, totalUseful, totalNotUseful }
})

const sortedStats = computed(() => {
  const sorted = [...allStats.value].sort((a, b) => {
    const aVal = a[sortProp.value as keyof FeedbackStats] as number
    const bVal = b[sortProp.value as keyof FeedbackStats] as number
    if (sortOrder.value === 'ascending') {
      return aVal - bVal
    }
    return bVal - aVal
  })
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sorted.slice(start, end)
})

// Load data on mount
onMounted(() => {
  loadStats()
})

// Load all stats
const loadStats = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await feedbackApi.getStats()
    if (response.data.success && response.data.data) {
      // API returns array when no ruleId specified
      allStats.value = Array.isArray(response.data.data) ? response.data.data : [response.data.data]
    } else {
      throw new Error(response.data.error || '获取反馈统计失败')
    }
    // Also load rules needing review
    await loadRulesNeedingReview()
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取反馈统计失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Load rules needing review
const loadRulesNeedingReview = async () => {
  reviewLoading.value = true

  try {
    const response = await feedbackApi.getRulesNeedingReview(reviewThreshold.value)
    if (response.data.success && response.data.data) {
      rulesNeedingReview.value = response.data.data
    } else {
      throw new Error(response.data.error || '获取需审查规则失败')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取需审查规则失败'
    ElMessage.error(message)
  } finally {
    reviewLoading.value = false
  }
}

// Handle sort change
const handleSortChange = ({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) => {
  sortProp.value = prop || 'falsePositiveRate'
  sortOrder.value = order || 'descending'
}

// Navigate to alert rule
const goToAlertRule = (ruleId: string) => {
  router.push({ path: '/ai-ops/alerts/rules', query: { ruleId } })
}

// Navigate to alert events
const goToAlertEvents = (ruleId: string) => {
  router.push({ path: '/ai-ops/alerts', query: { ruleId } })
}

// Utility functions
const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatPercent = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`
}

const getFalsePositiveColor = (rate: number): string => {
  if (rate >= 0.3) return '#f56c6c'
  if (rate >= 0.15) return '#e6a23c'
  return '#67c23a'
}
</script>


<style scoped>
.feedback-stats-view {
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
}

/* Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Overview Cards */
.overview-cards {
  margin-bottom: 20px;
}

.stat-card {
  margin-bottom: 16px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-info .stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-info .stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* Tabs */
.main-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.tab-badge {
  margin-left: 6px;
}

/* Table */
.rate-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rate-text {
  font-weight: 600;
  min-width: 50px;
}

.useful-count {
  color: #67c23a;
  font-weight: 600;
}

.not-useful-count {
  color: #f56c6c;
  font-weight: 600;
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* Threshold Card */
.threshold-card {
  margin-bottom: 16px;
}

.threshold-setting {
  display: flex;
  align-items: center;
  gap: 16px;
}

.threshold-label {
  font-size: 14px;
  color: #606266;
}

.threshold-value {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
  min-width: 40px;
}

.help-icon {
  color: #909399;
  cursor: help;
}

/* Review List */
.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-card {
  border-left: 4px solid #f56c6c;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.review-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-id {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.review-body {
  margin-bottom: 16px;
}

.review-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 12px;
}

.review-stats .stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-stats .stat-label {
  font-size: 12px;
  color: #909399;
}

.review-stats .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.review-stats .stat-value.useful {
  color: #67c23a;
}

.review-stats .stat-value.not-useful {
  color: #f56c6c;
}

.review-progress {
  margin-top: 8px;
}

.review-actions {
  display: flex;
  gap: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 12px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .threshold-setting {
    flex-wrap: wrap;
  }

  .review-stats {
    gap: 16px;
  }
}
</style>
