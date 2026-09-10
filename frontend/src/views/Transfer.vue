<template>
  <div class="page">
    <el-card>
      <div class="toolbar">
        <b>危废转运单</b>
        <el-button v-if="isKeeper" type="primary" :icon="Plus" @click="openCreate">新建转运单</el-button>
      </div>
      <el-table :data="list" size="small" border v-loading="loading">
        <el-table-column prop="manifestNo" label="转运单号" width="160" />
        <el-table-column prop="company" label="危废处置公司" min-width="160" />
        <el-table-column label="称重" width="90"><template #default="{ row }">{{ row.totalWeight }}kg</template></el-table-column>
        <el-table-column label="废液明细" min-width="220">
          <template #default="{ row }">
            <div v-for="r in row.records" :key="r.id" class="muted">
              {{ r.reqNo }}｜{{ r.reagentName }}｜{{ r.wasteType }} {{ r.amount }}ml｜{{ r.containerLabel }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="交接照片" width="130">
          <template #default="{ row }">
            <el-tag v-for="p in row.photoUrls" :key="p" size="small" style="margin: 1px">{{ p }}</el-tag>
            <span v-if="!row.photoUrls?.length" class="muted">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="MANIFEST_STATUS[row.status]?.type">{{ MANIFEST_STATUS[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="学院审核" min-width="140">
          <template #default="{ row }">
            <span v-if="row.reviewerName">{{ row.reviewerName }}<div class="muted">{{ row.reviewComment }}</div></span>
            <span v-else class="muted">待审核</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <template v-if="isCollege && row.status === 'PENDING_REVIEW'">
              <el-button size="small" type="success" @click="review(row, true)">通过</el-button>
              <el-button size="small" type="danger" @click="review(row, false)">驳回</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialog" title="新建转运单（选择已入库废液）" width="780px">
      <el-table :data="storedRecords" size="small" border height="260" @selection-change="(rows: any[]) => (selected = rows)">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="reqNo" label="申请单号" width="145" />
        <el-table-column prop="reagentName" label="原试剂" width="80" />
        <el-table-column prop="wasteType" label="废液类型" min-width="120" />
        <el-table-column label="数量" width="80"><template #default="{ row }">{{ row.amount }}ml</template></el-table-column>
        <el-table-column prop="containerLabel" label="容器标签" min-width="120" />
      </el-table>
      <el-form label-width="100px" style="margin-top: 14px">
        <el-form-item label="危废公司">
          <el-select v-model="form.company" filterable allow-create style="width: 320px">
            <el-option label="绿源危废处置有限公司" value="绿源危废处置有限公司" />
            <el-option label="中环危废联合处置中心" value="中环危废联合处置中心" />
          </el-select>
        </el-form-item>
        <el-form-item label="称重(kg)">
          <el-input-number v-model="form.totalWeight" :min="0.01" :precision="2" style="width: 180px" />
        </el-form-item>
        <el-form-item label="交接照片">
          <el-input v-model="photosText" type="textarea" :rows="2" placeholder="每行一个照片文件名/URL（演示环境以文本代替上传）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">提交学院审核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { MANIFEST_STATUS } from '../utils/format'

const store = useAuthStore()
const list = ref<any[]>([])
const storedRecords = ref<any[]>([])
const selected = ref<any[]>([])
const createDialog = ref(false)
const loading = ref(false)
const saving = ref(false)
const photosText = ref('')
const form = reactive({ company: '绿源危废处置有限公司', totalWeight: 10 })

const isKeeper = computed(() => ['warehouse_manager', 'admin'].includes(store.role))
const isCollege = computed(() => ['college_admin', 'admin'].includes(store.role))

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/waste/manifests')
  } finally {
    loading.value = false
  }
}

async function openCreate() {
  storedRecords.value = await api.get('/waste/records', { params: { status: 'STORED' } })
  selected.value = []
  createDialog.value = true
}

async function save() {
  if (!selected.value.length) return ElMessage.warning('请选择至少一条废液记录')
  saving.value = true
  try {
    await api.post('/waste/manifests', {
      wasteRecordIds: selected.value.map((r) => r.id),
      company: form.company,
      totalWeight: form.totalWeight,
      photoUrls: photosText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    })
    ElMessage.success('转运单已创建，等待学院审核')
    createDialog.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function review(row: any, approve: boolean) {
  const { value } = await ElMessageBox.prompt(
    `确认${approve ? '通过' : '驳回'}转运单 ${row.manifestNo}？`,
    '学院审核',
    { confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '审核意见（可选）' },
  )
  await api.post(`/waste/manifests/${row.id}/review`, { approve, comment: value || undefined })
  ElMessage.success('审核完成')
  await load()
}

onMounted(load)
</script>
