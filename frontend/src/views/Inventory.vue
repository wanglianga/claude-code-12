<template>
  <div class="page">
    <el-card class="page-card">
      <el-tabs v-model="tab">
        <el-tab-pane label="批次库存" name="batches">
          <div class="toolbar">
            <el-select v-model="filterReagent" placeholder="按试剂筛选" clearable filterable style="width: 220px" @change="loadBatches">
              <el-option v-for="r in catalog" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
            <el-button v-if="isKeeper" type="primary" :icon="Plus" @click="batchDialog = true">入库新批次</el-button>
          </div>
          <el-table :data="batches" size="small" border>
            <el-table-column prop="reagentName" label="试剂" width="100" />
            <el-table-column prop="batchNo" label="批号" width="140" />
            <el-table-column prop="warehouseName" label="库房" min-width="140" />
            <el-table-column label="余量/总量" width="130">
              <template #default="{ row }">{{ row.remainingAmount }} / {{ row.totalAmount }}{{ row.unit }}</template>
            </el-table-column>
            <el-table-column prop="expiryDate" label="有效期至" width="110">
              <template #default="{ row }">
                <span :style="{ color: expired(row.expiryDate) ? '#f56c6c' : 'inherit' }">
                  {{ row.expiryDate }}<el-tag v-if="expired(row.expiryDate)" type="danger" size="small" style="margin-left:4px">已过期</el-tag>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="开封" width="70">
              <template #default="{ row }"><el-tag size="small" :type="row.opened ? 'warning' : 'info'">{{ row.opened ? '已开封' : '未开封' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="废液桶液位" name="barrels">
          <div class="toolbar">
            <span class="muted">液位 ≥90% 自动预警并生成异常工单</span>
            <el-button v-if="isKeeper" type="primary" :icon="Plus" @click="barrelDialog = true">新增废液桶</el-button>
          </div>
          <el-table :data="barrels" size="small" border>
            <el-table-column prop="code" label="桶编号" width="130" />
            <el-table-column prop="wasteType" label="废液类型" min-width="140" />
            <el-table-column label="液位" min-width="220">
              <template #default="{ row }">
                <el-progress :percentage="Math.round((row.currentAmount / row.capacity) * 100)"
                  :status="row.currentAmount / row.capacity >= 1 ? 'exception' : row.currentAmount / row.capacity >= 0.9 ? 'warning' : undefined" />
              </template>
            </el-table-column>
            <el-table-column label="当前/容量" width="140">
              <template #default="{ row }">{{ row.currentAmount }} / {{ row.capacity }}ml</template>
            </el-table-column>
            <el-table-column prop="warehouseName" label="存放位置" min-width="130" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === '在用' ? 'success' : row.status === '即将满载' ? 'warning' : 'danger'">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="通风橱" name="hoods">
          <el-table :data="hoods" size="small" border style="max-width: 720px">
            <el-table-column prop="code" label="编号" width="120" />
            <el-table-column prop="location" label="位置" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === '正常' ? 'success' : 'danger'">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" v-if="canToggleHood">
              <template #default="{ row }">
                <el-button size="small" :type="row.status === '正常' ? 'warning' : 'success'"
                  @click="toggleHood(row)">{{ row.status === '正常' ? '标记故障' : '恢复运行' }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="batchDialog" title="入库新批次" width="480px">
      <el-form label-width="90px">
        <el-form-item label="试剂">
          <el-select v-model="batchForm.reagentId" filterable style="width: 100%">
            <el-option v-for="r in catalog" :key="r.id" :label="`${r.name}（${r.unit}）`" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库房">
          <el-select v-model="batchForm.warehouseId" style="width: 100%">
            <el-option v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="批号"><el-input v-model="batchForm.batchNo" placeholder="如 B2026-XX-01" /></el-form-item>
        <el-form-item label="数量"><el-input-number v-model="batchForm.totalAmount" :min="0.01" style="width: 200px" /></el-form-item>
        <el-form-item label="有效期至">
          <el-date-picker v-model="batchForm.expiryDate" type="date" value-format="YYYY-MM-DD" style="width: 200px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBatch">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="barrelDialog" title="新增废液桶" width="440px">
      <el-form label-width="90px">
        <el-form-item label="桶编号"><el-input v-model="barrelForm.code" placeholder="如 WF-ORG-02" /></el-form-item>
        <el-form-item label="废液类型">
          <el-select v-model="barrelForm.wasteType" style="width: 100%">
            <el-option v-for="t in WASTE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量(ml)"><el-input-number v-model="barrelForm.capacity" :min="1" style="width: 200px" /></el-form-item>
        <el-form-item label="存放位置"><el-input v-model="barrelForm.warehouseName" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="barrelDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBarrel">保存</el-button>
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
import { WASTE_TYPES } from '../utils/format'

const store = useAuthStore()
const tab = ref('batches')
const catalog = ref<any[]>([])
const warehouses = ref<any[]>([])
const batches = ref<any[]>([])
const barrels = ref<any[]>([])
const hoods = ref<any[]>([])
const filterReagent = ref('')
const batchDialog = ref(false)
const barrelDialog = ref(false)
const saving = ref(false)

const batchForm = reactive<any>({ reagentId: '', warehouseId: '', batchNo: '', totalAmount: 1000, expiryDate: '' })
const barrelForm = reactive<any>({ code: '', wasteType: WASTE_TYPES[0], capacity: 20000, warehouseName: '' })

const isKeeper = computed(() => ['warehouse_manager', 'admin'].includes(store.role))
const canToggleHood = computed(() => ['warehouse_manager', 'safety_officer', 'admin'].includes(store.role))
const expired = (d: string) => d < new Date().toISOString().slice(0, 10)

async function loadBatches() {
  batches.value = await api.get('/inventory/batches', { params: filterReagent.value ? { reagentId: filterReagent.value } : {} })
}
async function loadBarrels() { barrels.value = await api.get('/waste/barrels') }
async function loadHoods() { hoods.value = await api.get('/fume-hoods') }

async function saveBatch() {
  saving.value = true
  try {
    await api.post('/inventory/batches', batchForm)
    ElMessage.success('批次已入库')
    batchDialog.value = false
    await loadBatches()
  } finally { saving.value = false }
}

async function saveBarrel() {
  saving.value = true
  try {
    await api.post('/waste/barrels', barrelForm)
    ElMessage.success('废液桶已创建')
    barrelDialog.value = false
    await loadBarrels()
  } finally { saving.value = false }
}

async function toggleHood(row: any) {
  await api.patch(`/fume-hoods/${row.id}/status`, { status: row.status === '正常' ? '故障' : '正常' })
  ElMessage.success('已更新')
  await loadHoods()
}

onMounted(async () => {
  const [c, w] = await Promise.all([api.get('/catalog'), api.get('/warehouses')])
  catalog.value = c as any[]
  warehouses.value = w as any[]
  await Promise.all([loadBatches(), loadBarrels(), loadHoods()])
})
</script>
