<template>
  <div class="page">
    <div class="stat-grid">
      <div v-for="c in cards" :key="c.label" class="stat-card" :style="{ background: c.color }">
        <div class="num">{{ c.value }}</div>
        <div class="label">{{ c.label }}</div>
      </div>
    </div>

    <el-card class="page-card">
      <template #header>
        <div class="toolbar" style="margin: 0">
          <b>责任视图（按维度统计链路闭合情况）</b>
          <el-radio-group v-model="dim" size="small" @change="loadResp">
            <el-radio-button value="college">按学院</el-radio-button>
            <el-radio-button value="group">按课题组</el-radio-button>
            <el-radio-button value="warehouse">按库房</el-radio-button>
            <el-radio-button value="danger">按危险等级</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-table :data="resp" size="small" border>
        <el-table-column prop="name" label="维度" min-width="130" />
        <el-table-column prop="total" label="申请总数" width="90" sortable />
        <el-table-column prop="pending" label="审批中" width="80" />
        <el-table-column prop="inUse" label="使用中" width="80" />
        <el-table-column prop="wasteStored" label="废液待转运" width="100" />
        <el-table-column prop="closed" label="已闭环" width="80" />
        <el-table-column prop="openAnomalies" label="未处理异常" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.openAnomalies" type="danger" size="small">{{ row.openAnomalies }}</el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="闭环率" min-width="140">
          <template #default="{ row }">
            <el-progress :percentage="row.closureRate" :stroke-width="10" :status="row.closureRate === 100 ? 'success' : undefined" />
          </template>
        </el-table-column>
        <el-table-column prop="wasteStoredAmount" label="库存废液(ml)" width="110" />
        <el-table-column prop="wasteTransferredAmount" label="已转运废液(ml)" width="120" />
      </el-table>
    </el-card>

    <el-card v-if="anomalies.length" class="page-card">
      <template #header><b>最新未处理异常</b></template>
      <el-table :data="anomalies" size="small">
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="ANOMALY_MAP[row.type]?.type" size="small">{{ ANOMALY_MAP[row.type]?.label || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="320" />
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="row.requisitionId" size="small" link type="primary" @click="$router.push(`/requisitions/${row.requisitionId}`)">查看链路</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { ANOMALY_MAP, fmtTime } from '../utils/format'

const store = useAuthStore()
const summary = ref<any>({})
const resp = ref<any[]>([])
const anomalies = ref<any[]>([])
const dim = ref('college')

const cards = computed(() => {
  const s = summary.value
  const role = store.role
  const list: any[] = []
  if (role === 'student') {
    list.push({ label: '我的申请', value: s.myTotal ?? '-', color: '#409eff' })
    list.push({ label: '进行中', value: s.myInProgress ?? '-', color: '#e6a23c' })
  }
  if (role === 'advisor') list.push({ label: '待我审批', value: s.pendingAdvisor ?? '-', color: '#e6a23c' })
  if (role === 'safety_officer' || role === 'admin') {
    list.push({ label: '待安全审批', value: s.pendingSafety ?? '-', color: '#e6a23c' })
    list.push({ label: '未处理异常', value: s.openAnomalies ?? '-', color: '#f56c6c' })
  }
  if (role === 'warehouse_manager' || role === 'admin') {
    list.push({ label: '待出库', value: s.approvedToDispense ?? '-', color: '#409eff' })
    list.push({ label: '库存废液记录', value: s.storedWasteRecords ?? '-', color: '#909399' })
    list.push({ label: '液位预警桶', value: s.barrelsWarn ?? '-', color: '#f56c6c' })
  }
  if (role === 'college_admin') list.push({ label: '待审核转运单', value: s.pendingManifests ?? '-', color: '#e6a23c' })
  list.push({ label: '使用中申请', value: s.inUse ?? '-', color: '#67c23a' })
  list.push({ label: '已闭环申请', value: s.closed ?? '-', color: '#2c5f8a' })
  return list
})

async function loadResp() {
  resp.value = await api.get('/dashboard/responsibility', { params: { dim: dim.value } })
}

onMounted(async () => {
  summary.value = await api.get('/dashboard/summary')
  await loadResp()
  try {
    anomalies.value = (await api.get('/anomalies', { params: { status: 'OPEN' } })).slice(0, 5)
  } catch {
    anomalies.value = []
  }
})
</script>
