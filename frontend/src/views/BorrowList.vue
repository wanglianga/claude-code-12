<template>
  <div class="page">
    <el-card class="page-card">
      <div class="toolbar">
        <div>
          <el-radio-group v-model="scope" size="small" @change="load">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="todo">待我处理</el-radio-button>
          </el-radio-group>
          <el-select v-model="status" size="small" clearable placeholder="全部状态" style="width: 190px; margin-left: 10px" @change="load">
            <el-option v-for="(v, k) in BORROW_STATUS" :key="k" :label="v.label" :value="k" />
          </el-select>
        </div>
        <el-button v-if="store.role === 'student'" type="primary" :icon="Plus" @click="$router.push('/borrows/new')">发起跨组借用</el-button>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="borrowNo" label="借用单号" width="165" />
        <el-table-column label="试剂 / 风险" min-width="150">
          <template #default="{ row }">
            <b>{{ row.reagentName }}</b> {{ row.amount }}{{ row.unit }}
            <div class="danger-tags" style="margin-top: 2px">
              <el-tag v-for="c in row.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
              <el-tag v-if="row.opened" size="small" type="warning">已开封</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="借入 ← 借出（同楼层）" min-width="210">
          <template #default="{ row }">
            <div>{{ row.borrowerGroup }} <el-tag size="small" type="success">借入·废液责任</el-tag></div>
            <div class="muted">← {{ row.lenderGroup }}（{{ row.lenderLabLocation }}）</div>
          </template>
        </el-table-column>
        <el-table-column prop="projectName" label="实际使用项目" min-width="150" show-overflow-tooltip />
        <el-table-column label="风险等级" width="120">
          <template #default="{ row }">
            <el-tag :type="BORROW_RISK[row.riskLevel]?.type" size="small" effect="plain">{{ BORROW_RISK[row.riskLevel]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag :type="BORROW_STATUS[row.status]?.type" size="small">{{ BORROW_STATUS[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="145">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="$router.push(`/borrows/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无借用记录</template>
      </el-table>
    </el-card>

    <!-- 库管/安全员：课题组组间暂存库存（组间余流来源） -->
    <el-card v-if="canManageStock" class="page-card">
      <template #header>
        <div class="toolbar" style="margin: 0">
          <b>课题组暂存库存（已在本组实验室、可向同楼层他组借出的余量）</b>
          <el-button v-if="store.role === 'warehouse_manager' || store.role === 'admin'" size="small" type="primary" @click="openStock">登记暂存</el-button>
        </div>
      </template>
      <el-table :data="stocks" size="small" border v-loading="stockLoading">
        <el-table-column prop="researchGroup" label="持有课题组" width="150" />
        <el-table-column prop="labLocation" label="存放房间" width="110" />
        <el-table-column prop="reagentName" label="试剂" width="100" />
        <el-table-column label="危险类别" min-width="130">
          <template #default="{ row }">
            <span class="danger-tags">
              <el-tag v-for="c in row.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
              <el-tag v-if="!row.dangerCategories?.length" size="small" type="info">普通</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="sourceBatchNo" label="来源批号" width="130" />
        <el-table-column label="可借余量" width="120">
          <template #default="{ row }">{{ row.remainingAmount }}/{{ row.totalAmount }}{{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="有效期/开封" width="150">
          <template #default="{ row }">
            {{ row.expiryDate }}
            <el-tag v-if="row.opened" size="small" type="warning" style="margin-left: 4px">已开封</el-tag>
            <el-tag v-else size="small" type="success">未开封</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="storageCondition" label="保存条件" width="110" />
        <el-table-column prop="status" label="状态" width="80" />
      </el-table>
    </el-card>

    <el-dialog v-model="stockDialog" title="登记课题组暂存（他组从库房领出后存放本组实验室）" width="560px">
      <el-form :model="stockForm" label-width="110px">
        <el-form-item label="持有课题组">
          <el-input v-model="stockForm.researchGroup" placeholder="如：有机合成课题组" />
        </el-form-item>
        <el-form-item label="存放房间">
          <el-input v-model="stockForm.labLocation" placeholder="如：化学楼301（用于同楼层研判）" />
        </el-form-item>
        <el-form-item label="试剂">
          <el-select v-model="stockForm.reagentId" filterable style="width: 100%">
            <el-option v-for="r in catalog" :key="r.id" :label="`${r.name}（CAS ${r.casNo || '-'}）`" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源批号">
          <el-input v-model="stockForm.sourceBatchNo" placeholder="原库房批次号" />
        </el-form-item>
        <el-form-item label="暂存量">
          <el-input-number v-model="stockForm.totalAmount" :min="0.01" style="width: 180px" />
        </el-form-item>
        <el-form-item label="有效期至">
          <el-date-picker v-model="stockForm.expiryDate" type="date" value-format="YYYY-MM-DD" style="width: 180px" />
        </el-form-item>
        <el-form-item label="是否开封">
          <el-switch v-model="stockForm.opened" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingStock" @click="saveStock">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { BORROW_STATUS, BORROW_RISK, DANGER_TYPE, fmtTime } from '../utils/format'

const store = useAuthStore()
const list = ref<any[]>([])
const scope = ref('all')
const status = ref('')
const loading = ref(false)

const stocks = ref<any[]>([])
const stockLoading = ref(false)
const catalog = ref<any[]>([])
const canManageStock = computed(() => ['warehouse_manager', 'safety_officer', 'admin'].includes(store.role))
const stockDialog = ref(false)
const savingStock = ref(false)
const stockForm = reactive<any>({ researchGroup: '', labLocation: '', reagentId: '', sourceBatchNo: '', totalAmount: 100, expiryDate: '', opened: false })

async function load() {
  loading.value = true
  try {
    const params: any = {}
    if (scope.value === 'todo') params.scope = 'todo'
    if (status.value) params.status = status.value
    list.value = await api.get('/borrow', { params })
  } finally {
    loading.value = false
  }
}

async function loadStocks() {
  if (!canManageStock.value) return
  stockLoading.value = true
  try {
    stocks.value = await api.get('/borrow/stocks')
  } finally {
    stockLoading.value = false
  }
}

function openStock() {
  Object.assign(stockForm, { researchGroup: '', labLocation: '', reagentId: '', sourceBatchNo: '', totalAmount: 100, expiryDate: '', opened: false })
  stockDialog.value = true
}

async function saveStock() {
  savingStock.value = true
  try {
    await api.post('/borrow/stocks', stockForm)
    ElMessage.success('暂存已登记')
    stockDialog.value = false
    await loadStocks()
  } finally {
    savingStock.value = false
  }
}

onMounted(async () => {
  await load()
  if (canManageStock.value) {
    await loadStocks()
    catalog.value = await api.get('/catalog')
  }
})
</script>
