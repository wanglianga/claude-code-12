import dayjs from 'dayjs'

export const STATUS_MAP: Record<string, { label: string; type: string }> = {
  PENDING_ADVISOR: { label: '待导师审批', type: 'warning' },
  PENDING_SAFETY: { label: '待安全员审批', type: 'warning' },
  APPROVED: { label: '待出库', type: 'primary' },
  REJECTED: { label: '已驳回', type: 'danger' },
  IN_USE: { label: '使用中', type: 'primary' },
  USAGE_LOGGED: { label: '已登记使用', type: 'success' },
  WASTE_STORED: { label: '废液已入库', type: 'success' },
  CLOSED: { label: '已闭环', type: 'success' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export const DANGER_TYPE: Record<string, string> = {
  易制毒: 'danger',
  易制爆: 'danger',
  剧毒: 'danger',
  强腐蚀: 'warning',
  低温保存: 'info',
}

export const ANOMALY_MAP: Record<string, { label: string; type: string }> = {
  OVER_USAGE: { label: '用量超申请', type: 'danger' },
  FUME_HOOD_FAULT: { label: '通风橱故障', type: 'warning' },
  REAGENT_EXPIRED: { label: '试剂过期', type: 'danger' },
  BARREL_NEAR_FULL: { label: '废液桶将满', type: 'warning' },
  SPILL: { label: '异常洒漏', type: 'danger' },
  BORROW_RISK: { label: '借用本身风险', type: 'danger' },
  BORROW_TRANSFER_RISK: { label: '借用转移风险', type: 'warning' },
  BORROW_USAGE_RISK: { label: '借用使用风险', type: 'danger' },
}

export const BORROW_STATUS: Record<string, { label: string; type: string }> = {
  PENDING_BORROWER_ADVISOR: { label: '待借入方导师确认', type: 'warning' },
  PENDING_LENDER_ADVISOR: { label: '待借出方导师同意', type: 'warning' },
  PENDING_SAFETY: { label: '待安全员定路线', type: 'warning' },
  DISPENSE_READY: { label: '待组间发放', type: 'primary' },
  TRANSFER_PLANNED: { label: '待现场交接', type: 'primary' },
  HANDED_OVER: { label: '已交接', type: 'primary' },
  IN_USE: { label: '使用中', type: 'primary' },
  USAGE_LOGGED: { label: '已登记使用', type: 'success' },
  WASTE_ASSIGNED: { label: '废液已拆回', type: 'success' },
  CLOSED: { label: '已复盘闭环', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
  CANCELLED: { label: '已取消', type: 'info' },
}

export const BORROW_RISK: Record<string, { label: string; type: string }> = {
  LOW: { label: '低风险', type: 'success' },
  MEDIUM: { label: '中风险', type: 'info' },
  HIGH: { label: '高风险', type: 'warning' },
  CRITICAL: { label: '极高风险·禁借', type: 'danger' },
}

export const BORROW_RISK_SOURCES = ['借用本身', '转移过程', '实际使用']

export const ROLE_MAP: Record<string, string> = {
  student: '学生',
  advisor: '导师',
  safety_officer: '安全员',
  warehouse_manager: '库管',
  college_admin: '学院审核',
  admin: '系统管理员',
}

export const WASTE_TYPES = [
  '有机废液(不含卤)',
  '有机废液(含卤)',
  '无机酸碱废液',
  '含重金属废液',
  '含氰废液',
  '其他废液',
]

export const DANGER_CATEGORIES = ['易制毒', '易制爆', '剧毒', '强腐蚀', '低温保存']

export const MANIFEST_STATUS: Record<string, { label: string; type: string }> = {
  PENDING_REVIEW: { label: '待学院审核', type: 'warning' },
  TRANSFERRED: { label: '已转运', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
}

export const fmtTime = (t?: string | Date | null) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-')
export const fmtDate = (t?: string | Date | null) => (t ? dayjs(t).format('YYYY-MM-DD') : '-')
