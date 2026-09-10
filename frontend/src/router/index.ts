import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '工作台' } },
      { path: 'requisitions', component: () => import('../views/RequisitionList.vue'), meta: { title: '申请单' } },
      { path: 'requisitions/new', component: () => import('../views/RequisitionNew.vue'), meta: { title: '新建申请', roles: ['student'] } },
      { path: 'requisitions/:id', component: () => import('../views/RequisitionDetail.vue'), meta: { title: '申请详情' } },
      { path: 'approvals', component: () => import('../views/Approvals.vue'), meta: { title: '审批中心', roles: ['advisor', 'safety_officer'] } },
      { path: 'inventory', component: () => import('../views/Inventory.vue'), meta: { title: '库存管理', roles: ['warehouse_manager', 'safety_officer', 'admin'] } },
      { path: 'waste', component: () => import('../views/Waste.vue'), meta: { title: '废液管理', roles: ['warehouse_manager', 'safety_officer', 'admin', 'college_admin'] } },
      { path: 'transfer', component: () => import('../views/Transfer.vue'), meta: { title: '转运单', roles: ['warehouse_manager', 'college_admin', 'safety_officer', 'admin'] } },
      { path: 'anomalies', component: () => import('../views/Anomalies.vue'), meta: { title: '异常处理', roles: ['safety_officer', 'admin', 'warehouse_manager'] } },
      { path: 'catalog', component: () => import('../views/Catalog.vue'), meta: { title: '试剂目录', roles: ['admin'] } },
      { path: 'users', component: () => import('../views/Users.vue'), meta: { title: '用户管理', roles: ['admin'] } },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) return '/login'
  if (to.path === '/login' && token) return '/'
  const roles = to.meta.roles as string[] | undefined
  if (roles?.length) {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (user && !roles.includes(user.role)) return '/dashboard'
  }
})

export default router
