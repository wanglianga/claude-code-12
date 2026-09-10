// 全局枚举与常量定义

export enum Role {
  STUDENT = 'student',
  ADVISOR = 'advisor',
  SAFETY = 'safety_officer',
  KEEPER = 'warehouse_manager',
  COLLEGE = 'college_admin',
  ADMIN = 'admin',
}

// 申请单状态机：提交 -> 导师审批 -> 安全员审批 -> 出库 -> 使用登记 -> 废液入库 -> 转运闭环
export enum ReqStatus {
  PENDING_ADVISOR = 'PENDING_ADVISOR',
  PENDING_SAFETY = 'PENDING_SAFETY',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_USE = 'IN_USE',
  USAGE_LOGGED = 'USAGE_LOGGED',
  WASTE_STORED = 'WASTE_STORED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

// 危险试剂类别（平台自动判定）
export const DANGER_CATEGORIES = ['易制毒', '易制爆', '剧毒', '强腐蚀', '低温保存'] as const;

// 命中以下类别时强制双人领取
export const DUAL_PICKUP_CATEGORIES = ['易制毒', '易制爆', '剧毒'];

export enum AnomalyType {
  OVER_USAGE = 'OVER_USAGE', // 用量超申请
  FUME_HOOD_FAULT = 'FUME_HOOD_FAULT', // 通风橱故障
  REAGENT_EXPIRED = 'REAGENT_EXPIRED', // 试剂过期
  BARREL_NEAR_FULL = 'BARREL_NEAR_FULL', // 废液桶即将满载
  SPILL = 'SPILL', // 异常洒漏
}

export enum AnomalyStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum WasteStatus {
  STORED = 'STORED', // 已入库
  TRANSFERRED = 'TRANSFERRED', // 已转运
}

export enum ManifestStatus {
  PENDING_REVIEW = 'PENDING_REVIEW', // 待学院审核
  TRANSFERRED = 'TRANSFERRED', // 审核通过、已转运
  REJECTED = 'REJECTED',
}

export const WASTE_TYPES = [
  '有机废液(不含卤)',
  '有机废液(含卤)',
  '无机酸碱废液',
  '含重金属废液',
  '含氰废液',
  '其他废液',
];

// 废液桶满载预警阈值
export const BARREL_WARN_RATIO = 0.9;

export function needDualPickup(categories: string[]): boolean {
  return (categories || []).some((c) => (DUAL_PICKUP_CATEGORIES as string[]).includes(c));
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
