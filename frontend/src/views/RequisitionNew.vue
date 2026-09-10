<template>
  <div class="page">
    <el-card style="max-width: 860px">
      <template #header><b>新建危险试剂领用申请</b></template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="实验项目" prop="projectName">
          <el-input v-model="form.projectName" placeholder="如：天然产物提取工艺优化" />
        </el-form-item>
        <el-form-item label="导师" prop="advisorId">
          <el-select v-model="form.advisorId" placeholder="选择导师" style="width: 100%">
            <el-option v-for="a in advisors" :key="a.id" :label="`${a.name}（${a.researchGroup || a.college || ''}）`" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="试剂" prop="reagentId">
          <el-select v-model="form.reagentId" filterable placeholder="搜索试剂名称/CAS" style="width: 100%" @change="onReagent">
            <el-option v-for="r in catalog" :key="r.id" :label="`${r.name}（CAS ${r.casNo || '-'}）`" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-alert v-if="selected" :closable="false" style="margin-bottom: 18px"
          :type="selected.dangerCategories?.length ? 'error' : 'success'">
          <template #title>
            <span class="danger-tags">
              平台判定：
              <el-tag v-for="c in selected.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
              <el-tag v-if="!selected.dangerCategories?.length" size="small" type="success">普通试剂</el-tag>
              <el-tag v-if="dualPickup" size="small" type="danger" effect="dark">需双人领取</el-tag>
              <el-tag v-if="selected.maxSingleAmount" size="small" type="warning">单次限量 {{ selected.maxSingleAmount }}{{ selected.unit }}</el-tag>
              <el-tag v-if="selected.storageCondition" size="small" type="info">{{ selected.storageCondition }}</el-tag>
            </span>
          </template>
        </el-alert>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="浓度" prop="concentration">
              <el-input v-model="form.concentration" placeholder="如：分析纯 ≥99.5%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计用量" prop="estimatedAmount">
              <el-input-number v-model="form.estimatedAmount" :min="0.01" :precision="2" style="width: 70%" />
              <span style="margin-left: 8px">{{ selected?.unit || 'ml' }}</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="实验地点" prop="location">
          <el-input v-model="form.location" placeholder="如：化学楼301" />
        </el-form-item>
        <el-form-item label="操作时间" prop="time">
          <el-date-picker v-model="form.time" type="datetimerange" range-separator="至"
            start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="同组人员">
          <el-input v-model="form.teamMembers" placeholder="多人用顿号分隔，如：李四、王五" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="实验目的、特殊防护需求等" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="submit">提交申请</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
import { DANGER_TYPE } from '../utils/format'

const router = useRouter()
const catalog = ref<any[]>([])
const advisors = ref<any[]>([])
const saving = ref(false)
const formRef = ref()

const form = reactive<any>({
  projectName: '', advisorId: '', reagentId: '', concentration: '',
  estimatedAmount: 100, location: '', time: null, teamMembers: '', remark: '',
})

const rules = {
  projectName: [{ required: true, message: '请输入实验项目', trigger: 'blur' }],
  advisorId: [{ required: true, message: '请选择导师', trigger: 'change' }],
  reagentId: [{ required: true, message: '请选择试剂', trigger: 'change' }],
  concentration: [{ required: true, message: '请输入浓度', trigger: 'blur' }],
  estimatedAmount: [{ required: true, message: '请输入预计用量', trigger: 'blur' }],
  location: [{ required: true, message: '请输入实验地点', trigger: 'blur' }],
  time: [{ required: true, message: '请选择操作时间', trigger: 'change' }],
}

const selected = computed(() => catalog.value.find((r) => r.id === form.reagentId))
const dualPickup = computed(() =>
  (selected.value?.dangerCategories || []).some((c: string) => ['易制毒', '易制爆', '剧毒'].includes(c)),
)

function onReagent() {}

async function submit() {
  await formRef.value.validate()
  if (selected.value?.maxSingleAmount && form.estimatedAmount > selected.value.maxSingleAmount) {
    ElMessage.warning(`预计用量超过目录单次限量 ${selected.value.maxSingleAmount}${selected.value.unit}，安全员审批时将重点核查`)
  }
  saving.value = true
  try {
    const res: any = await api.post('/requisitions', {
      projectName: form.projectName,
      advisorId: form.advisorId,
      reagentId: form.reagentId,
      concentration: form.concentration,
      estimatedAmount: form.estimatedAmount,
      location: form.location,
      plannedStart: form.time[0],
      plannedEnd: form.time[1],
      teamMembers: form.teamMembers || undefined,
      remark: form.remark || undefined,
    })
    ElMessage.success(`申请 ${res.reqNo} 已提交，等待导师审批`)
    router.push(`/requisitions/${res.id}`)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const [c, a] = await Promise.all([api.get('/catalog'), api.get('/users/advisors')])
  catalog.value = c as any[]
  advisors.value = a as any[]
})
</script>
