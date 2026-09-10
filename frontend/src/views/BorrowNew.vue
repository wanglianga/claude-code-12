<template>
  <div class="page">
    <el-card style="max-width: 920px">
      <template #header><b>发起跨课题组试剂借用（仅同楼层实验室）</b></template>
      <el-alert type="info" :closable="false" style="margin-bottom: 16px"
        :title="`借入方：${opts.borrower?.researchGroup || '-'}（${opts.borrower?.labLocation || '-'}，${opts.borrower?.college || ''}，${opts.borrower?.floor || '?'} 层）。平台将先比较试剂危险等级、开封日期、保存条件、借用量与双方导师权限。`" />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="借出试剂" prop="stockId">
          <el-select v-model="form.stockId" filterable placeholder="仅显示同楼层、他组、有效可借的暂存试剂" style="width: 100%" @change="onStock">
            <el-option v-for="s in opts.stocks" :key="s.id" :value="s.id">
              <span>{{ s.reagentName }}（{{ s.sourceBatchNo }}）</span>
              <span style="float: right; color: #909399; font-size: 12px">
                {{ s.researchGroup }} · {{ s.labLocation }} · 余 {{ s.remainingAmount }}{{ s.unit }}{{ s.opened ? ' · 已开封' : '' }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="借用量" prop="amount">
              <el-input-number v-model="form.amount" :min="0.01" :max="selected?.remainingAmount" :precision="2" style="width: 100%" @change="loadRisk" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实际使用项目" prop="projectName">
              <el-input v-model="form.projectName" placeholder="废液责任将锚定该项目/本课题组" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="借用用途">
          <el-input v-model="form.purpose" type="textarea" :rows="2" placeholder="临时缺料说明、用途" />
        </el-form-item>
      </el-form>

      <!-- 五要素风险比较 -->
      <el-card v-if="risk" shadow="never" class="risk-card">
        <template #header>
          <div class="toolbar" style="margin: 0">
            <b>平台风险比较（五要素 + 同楼层）</b>
            <el-tag :type="BORROW_RISK[risk.risk.level]?.type" effect="dark" size="large">
              {{ BORROW_RISK[risk.risk.level]?.label }}
            </el-tag>
          </div>
        </template>
        <el-table :data="risk.risk.factors" size="small" :row-class-name="factorRow">
          <el-table-column prop="label" label="比较项" width="130" />
          <el-table-column label="结论" min-width="420">
            <template #default="{ row }">
              <el-tag :type="row.pass ? 'success' : 'danger'" size="small" style="margin-right: 8px">{{ row.pass ? '通过' : '阻断' }}</el-tag>
              {{ row.detail }}
            </template>
          </el-table-column>
        </el-table>
        <el-alert v-if="risk.risk.blocked" type="error" :closable="false" style="margin-top: 12px"
          title="存在硬阻断项，禁止发起该借用申请。剧毒试剂、跨楼层、超 30 天开封、保存条件不满足、超量或资质不足均不可借用。" />
        <el-alert v-else type="success" :closable="false" style="margin-top: 12px"
          title="风险比较通过，可发起申请；将依次经借入方导师确认、借出方导师同意、安全员确认转移路线与交接时间。" />
      </el-card>

      <div style="margin-top: 16px">
        <el-button type="primary" :loading="saving" :disabled="!!risk?.risk.blocked" @click="submit">提交借用申请</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
import { BORROW_RISK } from '../utils/format'

const router = useRouter()
const opts = ref<any>({ borrower: null, advisors: [], stocks: [] })
const risk = ref<any>(null)
const saving = ref(false)
const formRef = ref()

const form = reactive<any>({ stockId: '', amount: 50, projectName: '', purpose: '' })
const rules = {
  stockId: [{ required: true, message: '请选择借出试剂', trigger: 'change' }],
  amount: [{ required: true, message: '请填写借用量', trigger: 'blur' }],
  projectName: [{ required: true, message: '请填写实际使用项目（废液责任锚点）', trigger: 'blur' }],
}
const selected = ref<any>(null)

function factorRow({ row }: any) {
  return row.pass ? 'risk-pass' : 'risk-block'
}

async function onStock() {
  selected.value = opts.value.stocks.find((s: any) => s.id === form.stockId) || null
  form.amount = Math.min(form.amount, selected.value?.remainingAmount || form.amount)
  await loadRisk()
}

async function loadRisk() {
  if (!form.stockId || !form.amount) {
    risk.value = null
    return
  }
  risk.value = await api.post('/borrow/risk-preview', { stockId: form.stockId, amount: form.amount })
}

async function submit() {
  await formRef.value.validate()
  await loadRisk()
  if (risk.value?.risk.blocked) {
    ElMessage.error('风险比较未通过，禁止发起')
    return
  }
  saving.value = true
  try {
    const res: any = await api.post('/borrow', {
      stockId: form.stockId,
      amount: form.amount,
      projectName: form.projectName,
      purpose: form.purpose || undefined,
    })
    ElMessage.success(`借用单 ${res.borrowNo} 已提交，等待借入方导师确认`)
    router.push(`/borrows/${res.id}`)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  opts.value = await api.get('/borrow/new-options')
})
</script>

<style scoped>
.risk-card { background: #fafbfc; }
:deep(.risk-block) { background: #fef0f0; }
:deep(.risk-pass) { background: #f0f9eb; }
</style>
