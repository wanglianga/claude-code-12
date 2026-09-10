<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索名称/CAS" clearable style="width: 240px" @change="load" />
        <el-button type="primary" :icon="Plus" @click="openEdit()">新增试剂</el-button>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="name" label="试剂名称" width="110" />
        <el-table-column prop="casNo" label="CAS号" width="110" />
        <el-table-column label="危险类别" min-width="180">
          <template #default="{ row }">
            <span class="danger-tags">
              <el-tag v-for="c in row.dangerCategories" :key="c" :type="DANGER_TYPE[c]" size="small">{{ c }}</el-tag>
              <el-tag v-if="!row.dangerCategories?.length" size="small" type="info">普通</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="单次限量" width="110">
          <template #default="{ row }">{{ row.maxSingleAmount ? `${row.maxSingleAmount}${row.unit}` : '不限' }}</template>
        </el-table-column>
        <el-table-column prop="storageCondition" label="储存条件" width="120" />
        <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? '编辑试剂' : '新增试剂'" width="480px">
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="CAS号"><el-input v-model="form.casNo" /></el-form-item>
        <el-form-item label="危险类别">
          <el-checkbox-group v-model="form.dangerCategories">
            <el-checkbox v-for="c in DANGER_CATEGORIES" :key="c" :value="c">{{ c }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="form.unit" style="width: 140px">
            <el-option label="ml" value="ml" /><el-option label="g" value="g" /><el-option label="L" value="L" /><el-option label="kg" value="kg" />
          </el-select>
        </el-form-item>
        <el-form-item label="单次限量"><el-input-number v-model="form.maxSingleAmount" :min="0" style="width: 180px" /></el-form-item>
        <el-form-item label="储存条件"><el-input v-model="form.storageCondition" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import { DANGER_TYPE, DANGER_CATEGORIES } from '../utils/format'

const list = ref<any[]>([])
const keyword = ref('')
const loading = ref(false)
const dialog = ref(false)
const saving = ref(false)
const form = reactive<any>({ id: '', name: '', casNo: '', dangerCategories: [], unit: 'ml', maxSingleAmount: undefined, storageCondition: '', description: '' })

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/catalog', { params: keyword.value ? { keyword: keyword.value } : {} })
  } finally {
    loading.value = false
  }
}

function openEdit(row?: any) {
  Object.assign(form, row
    ? { ...row }
    : { id: '', name: '', casNo: '', dangerCategories: [], unit: 'ml', maxSingleAmount: undefined, storageCondition: '', description: '' })
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form }
    delete payload.id
    if (form.id) await api.patch(`/catalog/${form.id}`, payload)
    else await api.post('/catalog', payload)
    ElMessage.success('已保存')
    dialog.value = false
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
