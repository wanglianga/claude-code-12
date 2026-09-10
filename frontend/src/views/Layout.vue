<template>
  <el-container style="height: 100vh">
    <el-aside width="230px" class="aside">
      <div class="logo">危化品全链路管理平台</div>
      <el-menu :default-active="$route.path" router background-color="#001529" text-color="#a6adb4" active-text-color="#ffffff">
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div>
          <span class="page-title">{{ $route.meta.title || '工作台' }}</span>
          <el-tag v-if="store.user" size="small" style="margin-left: 10px">{{ ROLE_MAP[store.user.role] }}</el-tag>
        </div>
        <el-dropdown @command="onCmd">
          <span style="cursor: pointer">
            {{ store.user?.name }}（{{ store.user?.college || '未设置学院' }}）
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main style="background: #f0f2f5; padding: 0">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ROLE_MAP } from '../utils/format'

const store = useAuthStore()
const router = useRouter()

const ALL_MENUS = [
  { path: '/dashboard', title: '工作台', icon: 'Odometer', roles: ['student', 'advisor', 'safety_officer', 'warehouse_manager', 'college_admin', 'admin'] },
  { path: '/requisitions', title: '申请单', icon: 'Document', roles: ['student', 'advisor', 'safety_officer', 'warehouse_manager', 'college_admin', 'admin'] },
  { path: '/requisitions/new', title: '新建领用申请', icon: 'EditPen', roles: ['student'] },
  { path: '/approvals', title: '审批中心', icon: 'Stamp', roles: ['advisor', 'safety_officer'] },
  { path: '/inventory', title: '库存管理', icon: 'Box', roles: ['warehouse_manager', 'safety_officer', 'admin'] },
  { path: '/waste', title: '废液管理', icon: 'Delete', roles: ['warehouse_manager', 'safety_officer', 'college_admin', 'admin'] },
  { path: '/transfer', title: '转运单', icon: 'Van', roles: ['warehouse_manager', 'college_admin', 'safety_officer', 'admin'] },
  { path: '/anomalies', title: '异常处理', icon: 'WarningFilled', roles: ['safety_officer', 'warehouse_manager', 'admin'] },
  { path: '/catalog', title: '试剂目录', icon: 'Collection', roles: ['admin'] },
  { path: '/users', title: '用户管理', icon: 'User', roles: ['admin'] },
]

const menus = computed(() => ALL_MENUS.filter((m) => m.roles.includes(store.role)))

function onCmd(cmd: string) {
  if (cmd === 'logout') {
    store.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.aside { background: #001529; }
.logo { color: #fff; font-weight: 700; padding: 18px 16px; font-size: 15px; line-height: 1.4; }
.aside :deep(.el-menu) { border-right: none; }
.header { display: flex; justify-content: space-between; align-items: center; background: #fff; border-bottom: 1px solid #e4e7ed; }
.page-title { font-size: 16px; font-weight: 600; }
</style>
