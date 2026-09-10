<template>
  <div class="page" v-loading="loading">
    <template v-if="chain">
      <el-alert v-if="req.sourceType === 'BORROW'" type="warning" :closable="false" class="page-card" show-icon>
        <template #title>
          本单为跨课题组借用自动生成的「实际使用单」，试剂借自他组暂存；
          借用审批、转移路线与交接请在
          <el-link type="primary" :underline="false" @click="$router.push(`/borrows/${req.borrowId}`)">借用单详情</el-link>
          查看。产生废液时责任仍拆回本课题组（{{ req.researchGroup }}）。
        </template>
      </el-alert>
      <el-card class="page-card">
        <div class="toolbar">
          <div>
            <b style="font-size: 17px">{{ req.reqNo }}</b>
            <el-tag :type="STATUS_MAP[req.status]?.type" style="margin-left: 10px">{{ STATUS_MAP[req.status]?.label }}</el-tag>
            <el-tag v-if="chain.closed" type="success" effect="dark" style="margin-left: 6px">全链路已闭环</el-tag>
          </div>
          <span class="danger-tags">
            <el-tag v-for="c in req.dangerCategories" :key="c" :type="DANGER_TYPE[c]">{{ c }}</el-tag>
            <el-tag v-if="!req.dangerCategories?.length" type="info">普通试剂</el-tag>
            <el-tag v-if="req.requiresDualPickup" type="danger" effect="dark">双人领取</el-tag>
            <el-tag v-if="req.maxSingleAmount" type="warning">单次限量 {{ req.maxSingleAmount }}{{ req.unit }}</el-tag>
          </span>
        </div>
        <el-steps :active="activeStage" align-center process-status="process" finish-status="success" class="chain-panel">
          <el-step v-for="s in chain.stages" :key="s.key" :title="s.label"
            :status="s.rejected ? 'error' : s.done ? 'success' : 'wait'"
            :description="s.rejected ? '已驳回' : s.done ? fmtTime(s.time) : ''" />
        </el-steps>
      </el-card>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-card class="page-card">
            <template #header><b>申请信息</b></template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="实验项目" :span="2">{{ req.projectName }}</el-descriptions-item>
              <el-descriptions-item label="申请人">{{ req.studentName }}</el-descriptions-item>
              <el-descriptions-item label="导师">{{ req.advisorName }}</el-descriptions-item>
              <el-descriptions-item label="学院">{{ req.college || '-' }}</el-descriptions-item>
              <el-descriptions-item label="课题组">{{ req.researchGroup || '-' }}</el-descriptions-item>
              <el-descriptions-item label="试剂">{{ req.reagentName }}（CAS {{ req.casNo || '-' }}）</el-descriptions-item>
              <el-descriptions-item label="浓度">{{ req.concentration }}</el-descriptions-item>
              <el-descriptions-item label="预计用量">{{ req.estimatedAmount }}{{ req.unit }}</el-descriptions-item>
              <el-descriptions-item label="实验地点">{{ req.location }}</el-descriptions-item>
              <el-descriptions-item label="操作时间" :span="2">{{ fmtTime(req.plannedStart) }} ~ {{ fmtTime(req.plannedEnd) }}</el-descriptions-item>
              <el-descriptions-item label="同组人员" :span="2">{{ req.teamMembers || '-' }}</el-descriptions-item>
              <el-descriptions-item label="预约通风橱">{{ req.fumeHoodCode || '待安全员指定' }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ req.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item v-if="req.rejectReason" label="驳回原因" :span="2">
                <span style="color: #f56c6c">{{ req.rejectReason }}</span>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card v-if="chain.dispense" class="page-card">
            <template #header><b>出库记录</b></template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="批号">{{ chain.dispense.batchNo }}</el-descriptions-item>
              <el-descriptions-item label="库房">{{ chain.dispense.warehouseName }}</el-descriptions-item>
              <el-descriptions-item label="发放量">{{ chain.dispense.amount }}{{ chain.dispense.unit }}</el-descriptions-item>
              <el-descriptions-item label="出库后余量">{{ chain.dispense.remainingAfter }}{{ chain.dispense.unit }}</el-descriptions-item>
              <el-descriptions-item label="有效期至">{{ chain.dispense.expiryDate }}</el-descriptions-item>
              <el-descriptions-item label="开封状态">{{ chain.dispense.opened ? '已开封' : '未开封' }}</el-descriptions-item>
              <el-descriptions-item label="领取人">{{ chain.dispense.pickerName }}<span v-if="chain.dispense.secondPickerName">、{{ chain.dispense.secondPickerName }}（双人）</span></el-descriptions-item>
              <el-descriptions-item label="库管">{{ chain.dispense.keeperName }}</el-descriptions-item>
              <el-descriptions-item label="出库时间" :span="2">{{ fmtTime(chain.dispense.dispensedAt) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card v-if="chain.usageLogs.length" class="page-card">
            <template #header><b>使用登记</b></template>
            <el-table :data="chain.usageLogs" size="small" border>
              <el-table-column label="实际用量" width="90"><template #default="{ row }">{{ row.actualAmount }}{{ row.unit }}</template></el-table-column>
              <el-table-column label="剩余量" width="90"><template #default="{ row }">{{ row.remainingAmount }}{{ row.unit }}</template></el-table-column>
              <el-table-column label="废液" min-width="130">
                <template #default="{ row }">{{ row.wasteType ? `${row.wasteType} ${row.wasteAmount ?? ''}ml` : '-' }}</template>
              </el-table-column>
              <el-table-column label="异常" min-width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.fumeHoodFault" type="warning" size="small">通风橱故障</el-tag>
                  <el-tag v-if="row.spillDesc" type="danger" size="small" style="margin-left:4px">洒漏</el-tag>
                  <span v-if="!row.fumeHoodFault && !row.spillDesc">-</span>
                </template>
              </el-table-column>
              <el-table-column label="时间" width="145"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card v-if="chain.approvals.length" class="page-card">
            <template #header><b>审批记录</b></template>
            <el-timeline>
              <el-timeline-item v-for="a in chain.approvals" :key="a.id"
                :type="a.action === 'approve' ? 'success' : 'danger'" :timestamp="fmtTime(a.createdAt)">
                <b>{{ a.role === 'advisor' ? '导师' : '安全员' }} {{ a.approverName }}</b>
                {{ a.action === 'approve' ? '通过' : '驳回' }}
                <div v-if="a.comment" class="muted">{{ a.comment }}</div>
                <div v-if="a.checks" style="margin-top: 4px">
                  <el-tag v-for="(v, k) in a.checks" :key="k" size="small" :type="v ? 'success' : 'danger'" style="margin-right: 4px">
                    {{ CHECK_LABELS[k] || k }} {{ v ? '✓' : '✗' }}
                  </el-tag>
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-card>

          <el-card v-if="chain.wasteRecords.length" class="page-card">
            <template #header><b>废液入库 / 转运</b></template>
            <el-table :data="chain.wasteRecords" size="small" border>
              <el-table-column prop="wasteType" label="废液类型" min-width="120" />
              <el-table-column label="数量" width="80"><template #default="{ row }">{{ row.amount }}ml</template></el-table-column>
              <el-table-column prop="barrelCode" label="废液桶" width="110" />
              <el-table-column prop="containerLabel" label="容器标签" min-width="130" />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'TRANSFERRED' ? 'success' : 'warning'">
                    {{ row.status === 'TRANSFERRED' ? '已转运' : '已入库' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="转运单" min-width="140">
                <template #default="{ row }">
                  <span v-if="row.manifest">{{ row.manifest.manifestNo }}（{{ row.manifest.company }}）</span>
                  <span v-else class="muted">待转运</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card v-if="chain.anomalies.length" class="page-card">
            <template #header><b>关联异常</b></template>
            <el-table :data="chain.anomalies" size="small" border>
              <el-table-column label="类型" width="110">
                <template #default="{ row }"><el-tag size="small" :type="ANOMALY_MAP[row.type]?.type">{{ ANOMALY_MAP[row.type]?.label }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'OPEN' ? 'danger' : 'success'">{{ row.status === 'OPEN' ? '待处理' : '已处理' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- ===== 角色操作面板 ===== -->
          <el-card v-if="canAdvisorDecide" class="page-card action-card">
            <template #header><b>导师审批（确认实验必要性）</b></template>
            <el-input v-model="advisorComment" type="textarea" :rows="2" placeholder="审批意见" style="margin-bottom: 10px" />
            <el-button type="success" :loading="acting" @click="advisorDecide(true)">同意（实验必要）</el-button>
            <el-button type="danger" :loading="acting" @click="advisorDecide(false)">驳回</el-button>
          </el-card>

          <el-card v-if="canSafetyDecide" class="page-card action-card">
            <template #header><b>安全员审批（核查培训/防护/通风橱/同组/库存）</b></template>
            <div v-if="precheck" style="margin-bottom: 12px">
              <el-alert :closable="false" :type="precheck.training.ok ? 'success' : 'error'" style="margin-bottom: 8px"
                :title="precheck.training.ok ? `培训记录有效（${precheck.training.validRecords.map(r => r.courseName).join('、')}）` : '无有效培训记录，系统禁止通过'" />
              <el-alert :closable="false" :type="precheck.inventory.ok ? 'success' : 'error'" style="margin-bottom: 8px"
                :title="`有效库存 ${precheck.inventory.available}${req.unit} / 申请 ${precheck.inventory.required}${req.unit}${precheck.inventory.ok ? '' : '，库存不足，系统禁止通过'}`" />
              <div class="muted">同组人员：{{ precheck.teamMembers || '无' }}</div>
            </div>
            <el-form label-width="130px" size="small">
              <el-form-item v-for="item in CHECK_ITEMS" :key="item.key">
                <template #label>{{ item.label }}</template>
                <el-switch v-model="safetyForm.checklist[item.key]" active-text="符合" inactive-text="不符合" />
              </el-form-item>
              <el-form-item label="预约通风橱">
                <el-select v-model="safetyForm.fumeHoodId" placeholder="选择通风橱" style="width: 240px">
                  <el-option v-for="h in availableHoods" :key="h.id" :label="`${h.code}（${h.location}）`" :value="h.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="单次领用限量">
                <el-input-number v-model="safetyForm.maxSingleAmount" :min="0.01" style="width: 160px" />
                <span style="margin-left: 8px">{{ req.unit }}</span>
              </el-form-item>
              <el-form-item label="双人领取">
                <el-switch v-model="safetyForm.requiresDualPickup" />
              </el-form-item>
              <el-form-item label="审批意见">
                <el-input v-model="safetyForm.comment" type="textarea" :rows="2" />
              </el-form-item>
            </el-form>
            <el-button type="success" :loading="acting" @click="safetyDecide(true)">核查通过，批准</el-button>
            <el-button type="danger" :loading="acting" @click="safetyDecide(false)">驳回</el-button>
          </el-card>

          <el-card v-if="canDispense" class="page-card action-card">
            <template #header><b>库管出库</b></template>
            <el-form label-width="110px" size="small">
              <el-form-item label="出库批次">
                <el-select v-model="dispenseForm.batchId" style="width: 100%" placeholder="选择批次（按有效期排序）">
                  <el-option v-for="b in batches" :key="b.id" :value="b.id"
                    :label="`${b.batchNo}｜${b.warehouseName}｜余量 ${b.remainingAmount}${b.unit}｜有效期 ${b.expiryDate}${b.opened ? '｜已开封' : ''}`" />
                </el-select>
              </el-form-item>
              <el-form-item label="发放量">
                <el-input-number v-model="dispenseForm.amount" :min="0.01" :max="req.maxSingleAmount || undefined" style="width: 160px" />
                <span style="margin-left: 8px">{{ req.unit }}（限量 {{ req.maxSingleAmount || '不限' }}{{ req.unit }}）</span>
              </el-form-item>
              <el-form-item label="开封状态">
                <el-switch v-model="dispenseForm.opened" active-text="本次开封/已开封" inactive-text="未开封" />
              </el-form-item>
              <el-form-item label="领取人">
                <el-input v-model="dispenseForm.pickerName" style="width: 200px" />
              </el-form-item>
              <el-form-item v-if="req.requiresDualPickup" label="第二领取人">
                <el-input v-model="dispenseForm.secondPickerName" placeholder="双人领取必填" style="width: 200px" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doDispense">确认出库</el-button>
          </el-card>

          <el-card v-if="canLogUsage" class="page-card action-card">
            <template #header><b>使用登记</b></template>
            <el-form label-width="110px" size="small">
              <el-form-item label="实际用量">
                <el-input-number v-model="usageForm.actualAmount" :min="0" :precision="2" style="width: 160px" />
                <span style="margin-left: 8px">{{ req.unit }}（申请 {{ req.estimatedAmount }}{{ req.unit }}）</span>
              </el-form-item>
              <el-form-item label="剩余量">
                <el-input-number v-model="usageForm.remainingAmount" :min="0" :precision="2" style="width: 160px" />
                <span style="margin-left: 8px">{{ req.unit }}</span>
              </el-form-item>
              <el-form-item label="废液类型">
                <el-select v-model="usageForm.wasteType" clearable style="width: 200px">
                  <el-option v-for="t in WASTE_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
                <el-input-number v-model="usageForm.wasteAmount" :min="0" placeholder="废液量ml" style="width: 140px; margin-left: 8px" />
              </el-form-item>
              <el-form-item label="异常洒漏">
                <el-input v-model="usageForm.spillDesc" placeholder="无则留空；填写后将自动转安全员复核" />
              </el-form-item>
              <el-form-item label="通风橱故障">
                <el-switch v-model="usageForm.fumeHoodFault" active-text="故障" inactive-text="正常" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doUsage">提交登记</el-button>
          </el-card>

          <el-card v-if="canStoreWaste" class="page-card action-card">
            <template #header><b>废液入库（自动匹配原试剂与实验项目）</b></template>
            <el-form label-width="110px" size="small">
              <el-form-item label="废液类型">
                <el-select v-model="wasteForm.wasteType" style="width: 220px" @change="wasteForm.barrelId = ''">
                  <el-option v-for="t in WASTE_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="废液量">
                <el-input-number v-model="wasteForm.amount" :min="0.01" style="width: 160px" />
                <span style="margin-left: 8px">ml</span>
              </el-form-item>
              <el-form-item label="入库废液桶">
                <el-select v-model="wasteForm.barrelId" style="width: 100%" placeholder="选择同类型废液桶">
                  <el-option v-for="b in matchedBarrels" :key="b.id" :value="b.id"
                    :label="`${b.code}｜${b.currentAmount}/${b.capacity}ml｜${b.status}`" :disabled="b.status === '已满'" />
                </el-select>
              </el-form-item>
              <el-form-item label="容器标签">
                <el-input v-model="wasteForm.containerLabel" placeholder="如：废酸-硫酸-20260910" style="width: 260px" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doStoreWaste">确认入库</el-button>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { STATUS_MAP, DANGER_TYPE, ANOMALY_MAP, WASTE_TYPES, fmtTime } from '../utils/format'

const route = useRoute()
const store = useAuthStore()
const id = route.params.id as string

const chain = ref<any>(null)
const precheck = ref<any>(null)
const batches = ref<any[]>([])
const barrels = ref<any[]>([])
const loading = ref(false)
const acting = ref(false)

const CHECK_ITEMS = [
  { key: 'trainingOk', label: '培训记录有效' },
  { key: 'ppeOk', label: '防护用品齐备' },
  { key: 'fumeHoodOk', label: '通风橱已预约' },
  { key: 'teamOk', label: '同组人员明确' },
  { key: 'inventoryOk', label: '库房库存充足' },
]
const CHECK_LABELS: Record<string, string> = Object.fromEntries(CHECK_ITEMS.map((i) => [i.key, i.label]))

const advisorComment = ref('')
const safetyForm = reactive<any>({
  checklist: { trainingOk: false, ppeOk: false, fumeHoodOk: false, teamOk: false, inventoryOk: false },
  fumeHoodId: '', maxSingleAmount: 0, requiresDualPickup: false, comment: '',
})
const dispenseForm = reactive<any>({ batchId: '', amount: 0, opened: true, pickerName: '', secondPickerName: '' })
const usageForm = reactive<any>({ actualAmount: 0, remainingAmount: 0, wasteType: '', wasteAmount: undefined, spillDesc: '', fumeHoodFault: false })
const wasteForm = reactive<any>({ wasteType: '', amount: 0, barrelId: '', containerLabel: '' })

const req = computed(() => chain.value?.requisition || {})
const activeStage = computed(() => (chain.value ? chain.value.stages.filter((s: any) => s.done).length : 0))
const availableHoods = computed(() => (precheck.value?.fumeHoods || []).filter((h: any) => h.status === '正常'))
const matchedBarrels = computed(() => barrels.value.filter((b) => b.wasteType === wasteForm.wasteType))

const canAdvisorDecide = computed(() => req.value.status === 'PENDING_ADVISOR' && (store.role === 'advisor' || store.role === 'admin') && (store.role === 'admin' || req.value.advisorId === store.user.sub))
const canSafetyDecide = computed(() => req.value.status === 'PENDING_SAFETY' && ['safety_officer', 'admin'].includes(store.role))
const canDispense = computed(() => req.value.status === 'APPROVED' && ['warehouse_manager', 'admin'].includes(store.role))
const canLogUsage = computed(() => ['IN_USE', 'USAGE_LOGGED'].includes(req.value.status) && store.role === 'student' && req.value.studentId === store.user.sub)
const canStoreWaste = computed(() => ['USAGE_LOGGED', 'WASTE_STORED'].includes(req.value.status) && ['warehouse_manager', 'admin'].includes(store.role))

async function load() {
  loading.value = true
  try {
    chain.value = await api.get(`/requisitions/${id}/chain`)
    if (canSafetyDecide.value) {
      precheck.value = await api.get(`/requisitions/${id}/precheck`)
      safetyForm.maxSingleAmount = req.value.maxSingleAmount
      safetyForm.requiresDualPickup = req.value.requiresDualPickup
    }
    if (canDispense.value) {
      const avail: any = await api.get('/inventory/availability', { params: { reagentId: req.value.reagentId } })
      batches.value = avail.batches
      dispenseForm.amount = Math.min(req.value.estimatedAmount, req.value.maxSingleAmount || Infinity)
      dispenseForm.pickerName = req.value.studentName
    }
    if (canStoreWaste.value) {
      barrels.value = await api.get('/waste/barrels')
      const lastWaste = chain.value.usageLogs?.find((u: any) => u.wasteType)
      if (lastWaste) {
        wasteForm.wasteType = lastWaste.wasteType
        wasteForm.amount = lastWaste.wasteAmount || 0
      }
    }
  } finally {
    loading.value = false
  }
}

async function advisorDecide(approve: boolean) {
  acting.value = true
  try {
    await api.post(`/requisitions/${id}/advisor-decision`, { approve, comment: advisorComment.value || undefined })
    ElMessage.success('已提交审批结果')
    await load()
  } finally { acting.value = false }
}

async function safetyDecide(approve: boolean) {
  acting.value = true
  try {
    await api.post(`/requisitions/${id}/safety-decision`, {
      approve,
      comment: safetyForm.comment || undefined,
      checklist: approve ? safetyForm.checklist : undefined,
      fumeHoodId: approve ? safetyForm.fumeHoodId || undefined : undefined,
      maxSingleAmount: approve ? safetyForm.maxSingleAmount : undefined,
      requiresDualPickup: approve ? safetyForm.requiresDualPickup : undefined,
    })
    ElMessage.success('已提交审批结果')
    await load()
  } finally { acting.value = false }
}

async function doDispense() {
  if (!dispenseForm.batchId) return ElMessage.warning('请选择出库批次')
  acting.value = true
  try {
    await api.post(`/requisitions/${id}/dispense`, dispenseForm)
    ElMessage.success('出库完成')
    await load()
  } finally { acting.value = false }
}

async function doUsage() {
  acting.value = true
  try {
    await api.post(`/requisitions/${id}/usage`, {
      actualAmount: usageForm.actualAmount,
      remainingAmount: usageForm.remainingAmount,
      wasteType: usageForm.wasteType || undefined,
      wasteAmount: usageForm.wasteAmount,
      spillDesc: usageForm.spillDesc || undefined,
      fumeHoodFault: usageForm.fumeHoodFault,
    })
    ElMessage.success('登记成功')
    await load()
  } finally { acting.value = false }
}

async function doStoreWaste() {
  if (!wasteForm.barrelId || !wasteForm.containerLabel) return ElMessage.warning('请选择废液桶并填写容器标签')
  await ElMessageBox.confirm(
    `确认将 ${wasteForm.amount}ml「${wasteForm.wasteType}」入库？将自动匹配原试剂「${req.value.reagentName}」与项目「${req.value.projectName}」`,
    '废液入库确认',
  )
  acting.value = true
  try {
    await api.post(`/waste/requisitions/${id}/store`, wasteForm)
    ElMessage.success('废液已入库')
    await load()
  } finally { acting.value = false }
}

onMounted(load)
</script>

<style scoped>
.action-card { border-left: 4px solid #409eff; }
</style>
