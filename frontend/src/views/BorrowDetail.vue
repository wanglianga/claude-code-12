<template>
  <div class="page" v-loading="loading">
    <template v-if="data">
      <el-card class="page-card">
        <div class="toolbar">
          <div>
            <b style="font-size: 17px">{{ b.borrowNo }}</b>
            <el-tag :type="BORROW_STATUS[b.status]?.type" style="margin-left: 10px">{{ BORROW_STATUS[b.status]?.label }}</el-tag>
            <el-tag :type="BORROW_RISK[b.riskLevel]?.type" effect="dark" style="margin-left: 6px">{{ BORROW_RISK[b.riskLevel]?.label }}</el-tag>
            <el-tag v-if="b.status === 'CLOSED'" type="success" style="margin-left: 6px">复盘：风险来自{{ b.reviewRiskSource }}</el-tag>
          </div>
          <span class="danger-tags">
            <el-tag v-for="c in b.dangerCategories" :key="c" :type="DANGER_TYPE[c]">{{ c }}</el-tag>
            <el-tag v-if="!b.dangerCategories?.length" type="info">普通试剂</el-tag>
            <el-tag v-if="b.opened" type="warning">借用时已开封</el-tag>
            <el-tag v-if="dual" type="danger" effect="dark">双人交接</el-tag>
          </span>
        </div>
        <el-steps :active="doneCount" align-center process-status="process" finish-status="success" class="chain-panel">
          <el-step v-for="s in data.stages" :key="s.key" :title="s.label"
            :status="s.rejected ? 'error' : s.done ? 'success' : 'wait'"
            :description="s.rejected ? '已驳回' : s.done ? fmtTime(s.time) : (s.desc || '')" />
        </el-steps>
      </el-card>

      <el-row :gutter="16">
        <el-col :span="12">
          <!-- 双方课题组 + 五要素 -->
          <el-card class="page-card">
            <template #header><b>借用双方与五要素比较</b></template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="实际使用项目" :span="2">
                <b>{{ b.projectName }}</b>（废液责任锚点）
              </el-descriptions-item>
              <el-descriptions-item label="借入方课题组" :span="2">
                {{ b.borrowerGroup }} <el-tag size="small" type="success">废液责任方</el-tag>
                <span class="muted"> {{ b.borrowerLabLocation }} · 导师 {{ b.borrowerAdvisorName }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="借入学生">{{ b.borrowerStudentName }}</el-descriptions-item>
              <el-descriptions-item label="借入导师资质">
                <el-tag v-for="c in b.borrowerAdvisorClearance" :key="c" size="small" style="margin-right:2px">{{ c }}</el-tag>
                <span v-if="!b.borrowerAdvisorClearance?.length" class="muted">普通</span>
              </el-descriptions-item>
              <el-descriptions-item label="借出方课题组" :span="2">
                {{ b.lenderGroup }} <el-tag size="small" type="info">试剂来源方·仅留痕</el-tag>
                <span class="muted"> {{ b.lenderLabLocation }} · 导师 {{ b.lenderAdvisorName }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="试剂">{{ b.reagentName }}（CAS {{ b.casNo || '-' }}）</el-descriptions-item>
              <el-descriptions-item label="借用量">{{ b.amount }}{{ b.unit }}<span v-if="b.maxSingleAmount" class="muted">（限量 {{ b.maxSingleAmount }}）</span></el-descriptions-item>
              <el-descriptions-item label="来源批号">{{ b.sourceBatchNo }}</el-descriptions-item>
              <el-descriptions-item label="有效期至">{{ b.expiryDate }}</el-descriptions-item>
              <el-descriptions-item label="保存条件">{{ b.storageCondition || '常温' }}</el-descriptions-item>
              <el-descriptions-item label="开封状态">{{ b.opened ? `已开封（${fmtTime(b.openedAt)}）` : '未开封' }}</el-descriptions-item>
              <el-descriptions-item label="借用用途" :span="2">{{ b.purpose || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 风险研判 -->
          <el-card class="page-card">
            <template #header><b>平台风险研判（发起时快照）</b></template>
            <el-table :data="b.riskFactors" size="small" :row-class-name="factorRow">
              <el-table-column prop="label" label="比较项" width="120" />
              <el-table-column label="结论" min-width="300">
                <template #default="{ row }">
                  <el-tag :type="row.pass ? 'success' : 'danger'" size="small" style="margin-right: 6px">{{ row.pass ? '通过' : '阻断' }}</el-tag>
                  {{ row.detail }}
                </template>
              </el-table-column>
            </el-table>
            <div v-if="b.rejectReason" style="margin-top: 10px; color: #f56c6c">驳回原因：{{ b.rejectReason }}</div>
          </el-card>

          <!-- 转移路线与交接 -->
          <el-card class="page-card">
            <template #header><b>转移路线与交接（安全员确认）</b></template>
            <el-descriptions v-if="b.transferRoute" :column="1" size="small" border>
              <el-descriptions-item label="转移路线">{{ b.transferRoute }}</el-descriptions-item>
              <el-descriptions-item label="转运容器">{{ b.transferContainer }}</el-descriptions-item>
              <el-descriptions-item label="交接时间">{{ fmtTime(b.handoverTime) }}</el-descriptions-item>
              <el-descriptions-item label="交接地点">{{ b.handoverLocation }}</el-descriptions-item>
              <el-descriptions-item label="现场签字" v-if="b.handedOverAt">
                借出方 {{ b.handoverLenderName }} → 借入方 {{ b.handoverBorrowerName }}
                <el-tag v-if="b.dualHandover" size="small" type="danger" style="margin-left:6px">双人交接</el-tag>
                <div class="muted">监督：{{ b.handoverKeeperName }} · {{ fmtTime(b.handedOverAt) }}</div>
              </el-descriptions-item>
            </el-descriptions>
            <div v-else class="muted">待安全员确认转移路线与交接时间</div>
          </el-card>

          <!-- 库房发放同步 -->
          <el-card v-if="data.dispense" class="page-card">
            <template #header><b>库房发放台账（组间余流）</b></template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="实际使用单">{{ data.requisition?.reqNo }}</el-descriptions-item>
              <el-descriptions-item label="来源批号">{{ data.dispense.batchNo }}</el-descriptions-item>
              <el-descriptions-item label="流出量" :span="2">{{ data.dispense.amount }}{{ data.dispense.unit }}（{{ data.dispense.warehouseName }}，发放后余 {{ data.dispense.remainingAfter }}{{ data.dispense.unit }}）</el-descriptions-item>
              <el-descriptions-item label="领取人">{{ data.dispense.pickerName }}<span v-if="data.dispense.secondPickerName">、{{ data.dispense.secondPickerName }}（双人）</span></el-descriptions-item>
              <el-descriptions-item label="库管">{{ data.dispense.keeperName }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col :span="12">
          <!-- 审批/交接流水 -->
          <el-card class="page-card">
            <template #header><b>审批与交接流水</b></template>
            <el-timeline>
              <el-timeline-item v-for="a in data.approvals" :key="a.id"
                :type="['reject'].includes(a.action) ? 'danger' : a.node === 'handover' || a.node === 'dispense' ? 'primary' : 'success'"
                :timestamp="`${a.nodeLabel} · ${a.actorName} · ${fmtTime(a.createdAt)}`">
                {{ actionText(a.action) }}
                <div v-if="a.comment" class="muted">{{ a.comment }}</div>
              </el-timeline-item>
            </el-timeline>
          </el-card>

          <!-- 使用登记 -->
          <el-card v-if="data.usageLogs.length" class="page-card">
            <template #header><b>实际使用登记（{{ b.borrowerGroup }}）</b></template>
            <el-table :data="data.usageLogs" size="small" border>
              <el-table-column label="使用量" width="90"><template #default="{ row }">{{ row.actualAmount }}{{ row.unit }}</template></el-table-column>
              <el-table-column label="归还量" width="90"><template #default="{ row }">{{ row.remainingAmount }}{{ row.unit }}</template></el-table-column>
              <el-table-column label="废液/异常" min-width="180">
                <template #default="{ row }">
                  <span v-if="row.wasteType">{{ row.wasteType }} {{ row.wasteAmount }}ml</span>
                  <el-tag v-if="row.spillDesc" size="small" type="danger" style="margin-left:4px">洒漏</el-tag>
                  <span v-if="!row.wasteType && !row.spillDesc">-</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 废液责任拆回 -->
          <el-card v-if="data.wasteRecords.length" class="page-card">
            <template #header><b>废液责任拆回（防止借用记录与废液记录分离）</b></template>
            <el-alert type="warning" :closable="false" style="margin-bottom: 10px"
              :title="`废液责任归实际使用方「${data.wasteRecords[0].responsibleGroupName}」，试剂来源「${data.wasteRecords[0].sourceGroupName}」仅留痕不担责`" />
            <el-table :data="data.wasteRecords" size="small" border>
              <el-table-column prop="wasteType" label="废液类型" min-width="120" />
              <el-table-column label="数量" width="70"><template #default="{ row }">{{ row.amount }}ml</template></el-table-column>
              <el-table-column prop="barrelCode" label="废液桶" width="105" />
              <el-table-column prop="containerLabel" label="容器标签" min-width="130" show-overflow-tooltip />
              <el-table-column label="责任课题组" width="120">
                <template #default="{ row }"><el-tag size="small" type="warning">{{ row.responsibleGroupName }}</el-tag></template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'TRANSFERRED' ? 'success' : 'warning'">{{ row.status === 'TRANSFERRED' ? '已转运' : '已入库' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 风险事件（三来源） -->
          <el-card v-if="data.anomalies.length" class="page-card">
            <template #header><b>关联风险事件（复盘归因）</b></template>
            <el-table :data="data.anomalies" size="small" border>
              <el-table-column label="来源" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="sourceType(row.riskSource)">{{ row.riskSource || '借用本身' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="110">
                <template #default="{ row }"><el-tag size="small" :type="ANOMALY_MAP[row.type]?.type">{{ ANOMALY_MAP[row.type]?.label || row.type }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.status === 'OPEN' ? 'danger' : 'success'">{{ row.status === 'OPEN' ? '待处理' : '已处理' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 复盘结论 -->
          <el-card v-if="b.status === 'CLOSED'" class="page-card">
            <template #header><b>安全员复盘结论</b></template>
            <el-alert type="success" :closable="false"
              :title="`风险来自：${b.reviewRiskSource}`" :description="b.reviewConclusion" />
            <div class="muted" style="margin-top: 8px">{{ b.reviewByName }} · {{ fmtTime(b.reviewedAt) }}</div>
          </el-card>

          <!-- ========== 操作面板 ========== -->
          <el-card v-if="canBorrowerAdvisor" class="page-card action-card">
            <template #header><b>借入方导师确认（实验必要性 / 本组学生资质）</b></template>
            <el-input v-model="comment" type="textarea" :rows="2" placeholder="确认意见" style="margin-bottom: 10px" />
            <el-button type="success" :loading="acting" @click="decide('borrower-advisor-decision', true)">确认借用必要</el-button>
            <el-button type="danger" :loading="acting" @click="decide('borrower-advisor-decision', false)">驳回</el-button>
          </el-card>

          <el-card v-if="canLenderAdvisor" class="page-card action-card">
            <template #header><b>借出方导师同意（让出本组暂存试剂）</b></template>
            <el-input v-model="comment" type="textarea" :rows="2" placeholder="同意/驳回意见" style="margin-bottom: 10px" />
            <el-button type="success" :loading="acting" @click="decide('lender-advisor-decision', true)">同意借出</el-button>
            <el-button type="danger" :loading="acting" @click="decide('lender-advisor-decision', false)">驳回</el-button>
          </el-card>

          <el-card v-if="canSafety" class="page-card action-card">
            <template #header><b>安全员确认转移路线与交接时间</b></template>
            <el-alert type="warning" :closable="false" style="margin-bottom: 10px"
              :title="`双方实验室同楼层（${b.borrowerLabLocation} ↔ ${b.lenderLabLocation}）；剧毒/跨楼层/超期开封已在发起环节硬阻断`" />
            <el-form label-width="100px" size="small">
              <el-form-item label="转移路线">
                <el-input v-model="safetyForm.transferRoute" placeholder="如：化学楼301 → 三层东侧走廊 → 化学楼305，不走客梯" />
              </el-form-item>
              <el-form-item label="转运容器">
                <el-input v-model="safetyForm.transferContainer" placeholder="如：500ml 防倾覆试剂转运箱（带吸附棉）" />
              </el-form-item>
              <el-form-item label="交接时间">
                <el-date-picker v-model="safetyForm.handoverTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
              </el-form-item>
              <el-form-item label="交接地点">
                <el-input v-model="safetyForm.handoverLocation" placeholder="如：化学楼301门口缓冲区" />
              </el-form-item>
              <el-form-item label="审批意见">
                <el-input v-model="safetyForm.comment" type="textarea" :rows="2" />
              </el-form-item>
            </el-form>
            <el-button type="success" :loading="acting" @click="safetyApprove">确认路线，准予发放</el-button>
            <el-button type="danger" :loading="acting" @click="decide('safety-decision', false, safetyForm)">驳回</el-button>
          </el-card>

          <el-card v-if="canDispense" class="page-card action-card">
            <template #header><b>库管办理组间余流发放（同步库房发放台账）</b></template>
            <el-form label-width="100px" size="small">
              <el-form-item v-if="dual" label="第二领取人">
                <el-input v-model="dispenseForm.secondPickerName" placeholder="易制毒/易制爆/剧毒必须双人交接" style="width: 260px" />
              </el-form-item>
            </el-form>
            <el-alert type="info" :closable="false" style="margin-bottom: 10px"
              :title="`将从「${b.lenderGroup}（${b.sourceBatchNo}）」暂存扣减 ${b.amount}${b.unit}，并生成归属「${b.borrowerGroup}·${b.projectName}」的实际使用单`" />
            <el-button type="primary" :loading="acting" @click="doDispense">确认发放并生成使用单</el-button>
          </el-card>

          <el-card v-if="canHandover" class="page-card action-card">
            <template #header><b>现场交接（双方签字，库管/安全员监督）</b></template>
            <el-form label-width="100px" size="small">
              <el-form-item label="借出方交出人">
                <el-input v-model="handoverForm.handoverLenderName" :placeholder="`${b.lenderGroup} 在场人员`" style="width: 240px" />
              </el-form-item>
              <el-form-item label="借入方接收人">
                <el-input v-model="handoverForm.handoverBorrowerName" :placeholder="b.borrowerStudentName" style="width: 240px" />
              </el-form-item>
              <el-form-item label="交接问题">
                <el-input v-model="handoverForm.issue" type="textarea" :rows="2" placeholder="无则留空；如渗漏/容器破损/标签不清，填写后自动生成「转移过程」风险事件" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doHandover">完成现场交接</el-button>
          </el-card>

          <el-card v-if="canUsage" class="page-card action-card">
            <template #header><b>实际使用登记（项目：{{ b.projectName }}）</b></template>
            <el-form label-width="100px" size="small">
              <el-form-item label="实际使用量">
                <el-input-number v-model="usageForm.usedAmount" :min="0" :max="b.amount" style="width: 150px" />
                <span style="margin-left:8px">{{ b.unit }}（借入 {{ b.amount }}{{ b.unit }}）</span>
              </el-form-item>
              <el-form-item label="余量归还">
                <el-input-number v-model="usageForm.returnedAmount" :min="0" :max="b.amount" style="width: 150px" />
                <span style="margin-left:8px">{{ b.unit }}</span>
              </el-form-item>
              <el-form-item label="废液类型">
                <el-select v-model="usageForm.wasteType" clearable style="width: 200px">
                  <el-option v-for="t in WASTE_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
                <el-input-number v-model="usageForm.wasteAmount" :min="0" style="width: 130px; margin-left: 8px" placeholder="ml" />
              </el-form-item>
              <el-form-item label="异常洒漏">
                <el-input v-model="usageForm.spillDesc" placeholder="无则留空；填写后生成「实际使用」风险事件" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doUsage">提交使用登记</el-button>
          </el-card>

          <el-card v-if="canStoreWaste" class="page-card action-card">
            <template #header><b>借用废液入库（责任拆回 {{ b.borrowerGroup }}）</b></template>
            <el-form label-width="100px" size="small">
              <el-form-item label="废液类型">
                <el-select v-model="wasteForm.wasteType" style="width: 220" @change="wasteForm.barrelId = ''">
                  <el-option v-for="t in WASTE_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="废液量">
                <el-input-number v-model="wasteForm.amount" :min="0.01" style="width: 150px" /><span style="margin-left:8px">ml</span>
              </el-form-item>
              <el-form-item label="入库废液桶">
                <el-select v-model="wasteForm.barrelId" style="width: 100%" placeholder="选择同类型废液桶">
                  <el-option v-for="x in matchedBarrels" :key="x.id" :value="x.id"
                    :label="`${x.code}｜${x.currentAmount}/${x.capacity}ml｜${x.status}`" :disabled="x.status === '已满'" />
                </el-select>
              </el-form-item>
              <el-form-item label="容器标签">
                <el-input v-model="wasteForm.containerLabel" placeholder="如：借-废丙酮-高分子-20260910" style="width: 280px" />
              </el-form-item>
            </el-form>
            <el-button type="primary" :loading="acting" @click="doStoreWaste">确认入库（责任拆回）</el-button>
          </el-card>

          <el-card v-if="canReview" class="page-card action-card">
            <template #header><b>安全员复盘：判断风险来源并闭环</b></template>
            <el-radio-group v-model="reviewForm.reviewRiskSource" style="margin-bottom: 10px">
              <el-radio-button v-for="s in BORROW_RISK_SOURCES" :key="s" :value="s" :label="s">{{ s }}</el-radio-button>
            </el-radio-group>
            <el-input v-model="reviewForm.reviewConclusion" type="textarea" :rows="3"
              placeholder="综合借用审批、转移交接、实际使用与废液拆回情况，给出复盘结论" style="margin-bottom: 10px" />
            <el-button type="success" :loading="acting" @click="doReview">完成复盘并闭环</el-button>
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
import {
  ANOMALY_MAP, BORROW_RISK, BORROW_RISK_SOURCES, BORROW_STATUS, DANGER_TYPE, WASTE_TYPES, fmtTime,
} from '../utils/format'

const route = useRoute()
const store = useAuthStore()
const id = route.params.id as string

const data = ref<any>(null)
const loading = ref(false)
const acting = ref(false)
const comment = ref('')
const barrels = ref<any[]>([])

const safetyForm = reactive<any>({ transferRoute: '', transferContainer: '', handoverTime: '', handoverLocation: '', comment: '' })
const dispenseForm = reactive<any>({ secondPickerName: '' })
const handoverForm = reactive<any>({ handoverBorrowerName: '', handoverLenderName: '', issue: '' })
const usageForm = reactive<any>({ usedAmount: 0, returnedAmount: 0, wasteType: '', wasteAmount: undefined, spillDesc: '' })
const wasteForm = reactive<any>({ wasteType: '', amount: 0, barrelId: '', containerLabel: '' })
const reviewForm = reactive<any>({ reviewRiskSource: '实际使用', reviewConclusion: '' })

const b = computed(() => data.value?.borrow || {})
const dual = computed(() => (b.value.dangerCategories || []).some((c: string) => ['易制毒', '易制爆', '剧毒'].includes(c)))
const doneCount = computed(() => (data.value ? data.value.stages.filter((s: any) => s.done).length : 0))
const matchedBarrels = computed(() => barrels.value.filter((x) => x.wasteType === wasteForm.wasteType))

const role = computed(() => store.role)
const canBorrowerAdvisor = computed(() => b.value.status === 'PENDING_BORROWER_ADVISOR' && (role.value === 'admin' || (role.value === 'advisor' && b.value.borrowerAdvisorId === store.user.sub)))
const canLenderAdvisor = computed(() => b.value.status === 'PENDING_LENDER_ADVISOR' && (role.value === 'admin' || (role.value === 'advisor' && b.value.lenderAdvisorId === store.user.sub)))
const canSafety = computed(() => b.value.status === 'PENDING_SAFETY' && ['safety_officer', 'admin'].includes(role.value))
const canDispense = computed(() => b.value.status === 'DISPENSE_READY' && ['warehouse_manager', 'admin'].includes(role.value))
const canHandover = computed(() => b.value.status === 'TRANSFER_PLANNED' && ['warehouse_manager', 'safety_officer', 'admin'].includes(role.value))
const canUsage = computed(() => b.value.status === 'IN_USE' && role.value === 'student' && b.value.borrowerStudentId === store.user.sub)
const canStoreWaste = computed(() => b.value.status === 'USAGE_LOGGED' && b.value.wasteAmount > 0 && ['warehouse_manager', 'admin'].includes(role.value))
const canReview = computed(() => ['USAGE_LOGGED', 'WASTE_ASSIGNED'].includes(b.value.status) && ['safety_officer', 'admin'].includes(role.value))

function factorRow({ row }: any) {
  return row.pass ? 'risk-pass' : 'risk-block'
}
function actionText(a: string) {
  return ({ approve: '通过', reject: '驳回', submit: '发起', plan: '确认', dispense: '组间余流发放', handover: '现场交接', usage: '使用登记', review: '复盘闭环', return: '归还' } as any)[a] || a
}
function sourceType(s: string) {
  return s === '借用本身' ? 'danger' : s === '转移过程' ? 'warning' : 'success'
}

async function load() {
  loading.value = true
  try {
    data.value = await api.get(`/borrow/${id}`)
    if (canSafety.value) {
      safetyForm.transferRoute = `${b.value.lenderLabLocation} → 三层走廊 → ${b.value.borrowerLabLocation}（防泄漏转运，不走客梯）`
      safetyForm.transferContainer = dual.value ? '防倾覆试剂转运箱（带吸附棉），双人押运' : '防泄漏转运瓶'
    }
    if (canHandover.value) handoverForm.handoverBorrowerName = b.value.borrowerStudentName
    if (canStoreWaste.value) {
      barrels.value = await api.get('/waste/barrels')
      wasteForm.wasteType = b.value.wasteType
      wasteForm.amount = b.value.wasteAmount
    }
  } finally {
    loading.value = false
  }
}

async function decide(path: string, approve: boolean, extra?: any) {
  acting.value = true
  try {
    await api.post(`/borrow/${id}/${path}`, { approve, comment: comment.value || undefined, ...(extra || {}) })
    ElMessage.success('已提交')
    comment.value = ''
    await load()
  } finally { acting.value = false }
}

async function safetyApprove() {
  acting.value = true
  try {
    await api.post(`/borrow/${id}/safety-decision`, { approve: true, ...safetyForm })
    ElMessage.success('路线与交接时间已确认')
    await load()
  } finally { acting.value = false }
}

async function doDispense() {
  acting.value = true
  try {
    await api.post(`/borrow/${id}/dispense`, dispenseForm)
    ElMessage.success('组间余流发放完成，实际使用单已生成')
    await load()
  } finally { acting.value = false }
}

async function doHandover() {
  if (!handoverForm.handoverBorrowerName || !handoverForm.handoverLenderName) {
    return ElMessage.warning('请填写交接双方签字人')
  }
  acting.value = true
  try {
    await api.post(`/borrow/${id}/handover`, handoverForm)
    ElMessage.success('现场交接完成')
    await load()
  } finally { acting.value = false }
}

async function doUsage() {
  if (usageForm.usedAmount + usageForm.returnedAmount > b.value.amount + 0.001) {
    return ElMessage.warning('使用量+归还量不能超过借入量')
  }
  acting.value = true
  try {
    await api.post(`/borrow/${id}/usage`, {
      usedAmount: usageForm.usedAmount,
      returnedAmount: usageForm.returnedAmount,
      wasteType: usageForm.wasteType || undefined,
      wasteAmount: usageForm.wasteAmount,
      spillDesc: usageForm.spillDesc || undefined,
    })
    ElMessage.success('使用登记成功')
    await load()
  } finally { acting.value = false }
}

async function doStoreWaste() {
  if (!wasteForm.barrelId || !wasteForm.containerLabel) return ElMessage.warning('请选择废液桶并填写容器标签')
  await ElMessageBox.confirm(
    `确认废液入库？责任将拆回实际使用项目「${b.value.projectName}」/ 课题组「${b.value.borrowerGroup}」，试剂来源「${b.value.lenderGroup}」仅留痕`,
    '借用废液责任拆回确认',
  )
  acting.value = true
  try {
    await api.post(`/waste/requisitions/${b.value.usageRequisitionId}/store`, wasteForm)
    ElMessage.success('废液已入库，责任已拆回实际使用课题组')
    await load()
  } finally { acting.value = false }
}

async function doReview() {
  if (!reviewForm.reviewConclusion) return ElMessage.warning('请填写复盘结论')
  acting.value = true
  try {
    await api.post(`/borrow/${id}/review`, reviewForm)
    ElMessage.success('复盘完成，借用链路闭环')
    await load()
  } finally { acting.value = false }
}

onMounted(load)
</script>

<style scoped>
.action-card { border-left: 4px solid #e6a23c; }
:deep(.risk-block) { background: #fef0f0; }
:deep(.risk-pass) { background: #f0f9eb; }
</style>
