<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <div class="title">高校实验室危险试剂<br />领用与废液回收平台</div>
      <el-form :model="form" @keyup.enter="submit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" show-password placeholder="密码" :prefix-icon="Lock" />
        </el-form-item>
        <el-button type="primary" style="width: 100%" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
      <el-divider content-position="left">演示账号（点击填充）</el-divider>
      <div class="demo-accounts">
        <el-tag v-for="a in accounts" :key="a.u" class="acc" @click="fill(a)">{{ a.label }}</el-tag>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const store = useAuthStore()
const form = reactive({ username: '', password: '' })
const loading = ref(false)

const accounts = [
  { label: '学生 张三', u: 'zhangsan', p: 'Student@123' },
  { label: '导师 王建国', u: 'wangprof', p: 'Advisor@123' },
  { label: '安全员 陈安全', u: 'safety', p: 'Safety@123' },
  { label: '库管 赵库管', u: 'keeper', p: 'Keeper@123' },
  { label: '学院 孙主任', u: 'college', p: 'College@123' },
  { label: '管理员', u: 'admin', p: 'Admin@12345' },
]

function fill(a: any) {
  form.username = a.u
  form.password = a.p
}

async function submit() {
  if (!form.username || !form.password) return ElMessage.warning('请输入用户名和密码')
  loading.value = true
  try {
    await store.login(form.username, form.password)
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1f3a5f 0%, #2c5f8a 100%); }
.login-card { width: 400px; }
.title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px; color: #1f3a5f; line-height: 1.5; }
.demo-accounts { display: flex; flex-wrap: wrap; gap: 8px; }
.acc { cursor: pointer; }
</style>
