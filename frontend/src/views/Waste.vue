<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <el-radio-group v-model="status" size="small" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="STORED">已入库待转运</el-radio-button>
          <el-radio-button value="TRANSFERRED">已转运</el-radio-button>
        </el-radio-group>
        <span class="muted">废液入库操作在「申请单详情」页完成（自动匹配原试剂与实验项目）</span>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="reqNo" label="申请单号" width="150" />
        <el-table-column prop="reagentName" label="原试剂" width="90" />
        <el-table-column prop="projectName" label="实验项目" min-width="150" show-overflow-tooltip />
        <el-table-column prop="wasteType" label="废液类型" min-width="120" />
        <el-table-column label="数量" width="80"><template #default="{ row }">{{ row.amount }}ml</template></el-table-column>
        <el-table-column prop="barrelCode" label="废液桶" width="110" />
        <el-table-column prop="containerLabel" label="容器标签" min-width="130" />
        <el-table-column label="废液责任课题组" min-width="150">
          <template #default="{ row }">
            <el-tag size="small" type="warning">{{ row.responsibleGroupName || row.projectName }}</el-tag>
            <div v-if="row.sourceType === 'BORROW'" class="muted">借自：{{ row.sourceGroupName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.sourceType === 'BORROW' ? 'warning' : 'info'">{{ row.sourceType === 'BORROW' ? '跨组借用' : '正常领用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="storedByName" label="经办" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'TRANSFERRED' ? 'success' : 'warning'">
              {{ row.status === 'TRANSFERRED' ? '已转运' : '已入库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="入库时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="链路" width="90">
          <template #default="{ row }">
            <el-button size="small" link type="primary"
              @click="row.sourceType === 'BORROW' && row.borrowId ? $router.push(`/borrows/${row.borrowId}`) : $router.push(`/requisitions/${row.requisitionId}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api'
import { fmtTime } from '../utils/format'

const list = ref<any[]>([])
const status = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/waste/records', { params: status.value ? { status: status.value } : {} })
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
