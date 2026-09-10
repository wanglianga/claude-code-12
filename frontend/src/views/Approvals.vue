<template>
  <div class="page">
    <el-card>
      <template #header><b>{{ store.role === 'advisor' ? '待我审批（导师）' : '待安全核查的申请' }}</b></template>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="reqNo" label="申请单号" width="160" />
        <el-table-column prop="reagentName" label="试剂" width="100" />
        <el-table-column label="危险类别" min-width="140">
          <template #default="{ row }">
            <span class="danger-tags">
              <el-tag v-for="c in row.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="projectName" label="实验项目" min-width="160" show-overflow-tooltip />
        <el-table-column prop="studentName" label="申请人" width="80" />
        <el-table-column label="用量" width="90">
          <template #default="{ row }">{{ row.estimatedAmount }}{{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="操作时间" width="160">
          <template #default="{ row }">{{ fmtTime(row.plannedStart) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="$router.push(`/requisitions/${row.id}`)">去审批</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无待审批申请</template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { DANGER_TYPE, fmtTime } from '../utils/format'

const store = useAuthStore()
const list = ref<any[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const status = store.role === 'advisor' ? 'PENDING_ADVISOR' : 'PENDING_SAFETY'
    list.value = await api.get('/requisitions', { params: { status } })
  } finally {
    loading.value = false
  }
})
</script>
