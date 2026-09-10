<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <div>
          <el-select v-model="status" placeholder="全部状态" clearable style="width: 180px" @change="load">
            <el-option v-for="(v, k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
          </el-select>
        </div>
        <el-button v-if="store.role === 'student'" type="primary" :icon="Plus" @click="$router.push('/requisitions/new')">新建领用申请</el-button>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="reqNo" label="申请单号" width="175">
          <template #default="{ row }">
            {{ row.reqNo }}
            <el-tag v-if="row.sourceType === 'BORROW'" size="small" type="warning" style="margin-left: 2px">借用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reagentName" label="试剂" width="100" />
        <el-table-column label="危险类别" min-width="150">
          <template #default="{ row }">
            <span class="danger-tags">
              <el-tag v-for="c in row.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
              <el-tag v-if="!row.dangerCategories?.length" size="small" type="info">普通</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="projectName" label="实验项目" min-width="160" show-overflow-tooltip />
        <el-table-column prop="studentName" label="申请人" width="80" />
        <el-table-column prop="advisorName" label="导师" width="80" />
        <el-table-column label="用量" width="90">
          <template #default="{ row }">{{ row.estimatedAmount }}{{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type" size="small">{{ STATUS_MAP[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="$router.push(`/requisitions/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { STATUS_MAP, DANGER_TYPE, fmtTime } from '../utils/format'

const store = useAuthStore()
const list = ref<any[]>([])
const status = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/requisitions', { params: status.value ? { status: status.value } : {} })
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
