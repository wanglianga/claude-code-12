<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <el-radio-group v-model="status" size="small" @change="load">
          <el-radio-button value="OPEN">待处理</el-radio-button>
          <el-radio-button value="RESOLVED">已处理</el-radio-button>
          <el-radio-button value="">全部</el-radio-button>
        </el-radio-group>
        <span class="muted">用量超申请 / 通风橱故障 / 试剂过期 / 废液桶将满 / 异常洒漏 自动转入安全员复核</span>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="ANOMALY_MAP[row.type]?.type">{{ ANOMALY_MAP[row.type]?.label || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="异常描述" min-width="320" />
        <el-table-column prop="reqNo" label="关联申请" width="150">
          <template #default="{ row }">{{ row.reqNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'OPEN' ? 'danger' : 'success'">{{ row.status === 'OPEN' ? '待处理' : '已处理' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理结果" min-width="160">
          <template #default="{ row }">
            <span v-if="row.resolution">{{ row.resolution }}<div class="muted">{{ row.resolvedByName }} · {{ fmtTime(row.resolvedAt) }}</div></span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.requisitionId" size="small" link type="primary" @click="openChain(row)">查看链路</el-button>
            <el-button v-if="row.status === 'OPEN' && canResolve" size="small" type="primary" @click="resolve(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="chainDrawer" title="全链路闭合情况" size="560px">
      <template v-if="chain">
        <el-alert :closable="false" :type="chain.closed ? 'success' : 'warning'" style="margin-bottom: 14px"
          :title="chain.closed ? '该申请已闭环：申请→审批→出库→使用→废液→转运全部完成' : '链路未闭合，请检查下方各环节'" />
        <el-steps direction="vertical" :active="chain.stages.filter((s: any) => s.done).length">
          <el-step v-for="s in chain.stages" :key="s.key" :title="s.label"
            :status="s.rejected ? 'error' : s.done ? 'success' : 'wait'"
            :description="s.rejected ? '已驳回' : s.done ? fmtTime(s.time) : '未完成'" />
        </el-steps>
        <el-descriptions :column="1" size="small" border style="margin-top: 14px">
          <el-descriptions-item label="申请单号">{{ chain.requisition.reqNo }}</el-descriptions-item>
          <el-descriptions-item label="试剂">{{ chain.requisition.reagentName }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ chain.requisition.studentName }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ STATUS_MAP[chain.requisition.status]?.label }}</el-descriptions-item>
        </el-descriptions>
        <el-button style="margin-top: 14px" type="primary" @click="$router.push(`/requisitions/${chain.requisition.id}`)">进入申请详情</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { ANOMALY_MAP, STATUS_MAP, fmtTime } from '../utils/format'

const store = useAuthStore()
const list = ref<any[]>([])
const status = ref('OPEN')
const loading = ref(false)
const chainDrawer = ref(false)
const chain = ref<any>(null)

const canResolve = computed(() => ['safety_officer', 'admin'].includes(store.role))

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/anomalies', { params: status.value ? { status: status.value } : {} })
  } finally {
    loading.value = false
  }
}

async function openChain(row: any) {
  chain.value = await api.get(`/requisitions/${row.requisitionId}/chain`)
  chainDrawer.value = true
}

async function resolve(row: any) {
  const { value } = await ElMessageBox.prompt('请输入处理结论', `处理异常：${ANOMALY_MAP[row.type]?.label}`, {
    confirmButtonText: '提交', cancelButtonText: '取消',
    inputValidator: (v) => (v?.trim() ? true : '处理结论不能为空'),
  })
  await api.post(`/anomalies/${row.id}/resolve`, { resolution: value })
  ElMessage.success('已处理')
  await load()
}

onMounted(load)
</script>
