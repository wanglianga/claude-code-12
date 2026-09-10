<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <el-select v-model="roleFilter" placeholder="全部角色" clearable style="width: 160px" @change="load">
          <el-option v-for="(v, k) in ROLE_MAP" :key="k" :label="v" :value="k" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="userDialog = true">新增用户</el-button>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 8px 24px">
              <b>培训记录</b>
              <el-table :data="trainings[row.id] || []" size="small" border style="margin-top: 8px; max-width: 720px">
                <el-table-column prop="courseName" label="课程" min-width="160" />
                <el-table-column prop="passedAt" label="通过日期" width="110" />
                <el-table-column label="有效期至" width="140">
                  <template #default="{ row: t }">
                    <span :style="{ color: t.validUntil < today ? '#f56c6c' : 'inherit' }">
                      {{ t.validUntil }}<el-tag v-if="t.validUntil < today" type="danger" size="small" style="margin-left:4px">已过期</el-tag>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="certificateNo" label="证书编号" width="130" />
              </el-table>
              <el-button size="small" style="margin-top: 8px" @click="openTraining(row)">添加培训记录</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column label="角色" width="110">
          <template #default="{ row }"><el-tag size="small">{{ ROLE_MAP[row.role] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="college" label="学院" min-width="120" />
        <el-table-column prop="researchGroup" label="课题组" min-width="130" />
        <el-table-column prop="phone" label="电话" width="120" />
      </el-table>
    </el-card>

    <el-dialog v-model="userDialog" title="新增用户" width="440px">
      <el-form label-width="90px">
        <el-form-item label="用户名"><el-input v-model="userForm.username" /></el-form-item>
        <el-form-item label="初始密码"><el-input v-model="userForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="userForm.name" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option v-for="(v, k) in ROLE_MAP" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="学院"><el-input v-model="userForm.college" /></el-form-item>
        <el-form-item label="课题组"><el-input v-model="userForm.researchGroup" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="userForm.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="trainingDialog" :title="`添加培训记录：${currentUser?.name || ''}`" width="440px">
      <el-form label-width="90px">
        <el-form-item label="课程名称"><el-input v-model="trainingForm.courseName" /></el-form-item>
        <el-form-item label="通过日期">
          <el-date-picker v-model="trainingForm.passedAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期至">
          <el-date-picker v-model="trainingForm.validUntil" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="证书编号"><el-input v-model="trainingForm.certificateNo" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="trainingDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTraining">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { ROLE_MAP } from '../utils/format'

const list = ref<any[]>([])
const trainings = ref<Record<string, any[]>>({})
const roleFilter = ref('')
const loading = ref(false)
const saving = ref(false)
const userDialog = ref(false)
const trainingDialog = ref(false)
const currentUser = ref<any>(null)
const today = new Date().toISOString().slice(0, 10)

const userForm = reactive<any>({ username: '', password: '', name: '', role: 'student', college: '', researchGroup: '', phone: '' })
const trainingForm = reactive<any>({ courseName: '', passedAt: '', validUntil: '', certificateNo: '' })

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/users', { params: roleFilter.value ? { role: roleFilter.value } : {} })
    for (const u of list.value as any[]) {
      trainings.value[u.id] = await api.get(`/users/${u.id}/trainings`)
    }
  } finally {
    loading.value = false
  }
}

async function saveUser() {
  saving.value = true
  try {
    await api.post('/users', userForm)
    ElMessage.success('用户已创建')
    userDialog.value = false
    await load()
  } finally {
    saving.value = false
  }
}

function openTraining(user: any) {
  currentUser.value = user
  Object.assign(trainingForm, { courseName: '', passedAt: '', validUntil: '', certificateNo: '' })
  trainingDialog.value = true
}

async function saveTraining() {
  saving.value = true
  try {
    await api.post(`/users/${currentUser.value.id}/trainings`, trainingForm)
    ElMessage.success('培训记录已添加')
    trainingDialog.value = false
    trainings.value[currentUser.value.id] = await api.get(`/users/${currentUser.value.id}/trainings`)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
