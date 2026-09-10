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
  BORROW_RISK = 'BORROW_RISK', // 借用本身风险（危险等级/开封/权限/保存条件）
  BORROW_TRANSFER_RISK = 'BORROW_TRANSFER_RISK', // 借用转移过程风险（路线/交接）
  BORROW_USAGE_RISK = 'BORROW_USAGE_RISK', // 借用试剂实际使用风险（含废液责任）
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

// ==================== 跨课题组借用 ====================

// 借用风险等级（平台根据五要素自动研判，等级决定审批与交接要求）
export enum BorrowRiskLevel {
  LOW = 'LOW', // 普通试剂 / 未开封 / 少量
  MEDIUM = 'MEDIUM', // 命中一般危险类别
  HIGH = 'HIGH', // 危险等级升档、已开封、保存条件特殊
  CRITICAL = 'CRITICAL', // 剧毒类试剂借用
}

export const BORROW_RISK_LABEL: Record<string, { label: string; type: string }> = {
  LOW: { label: '低风险', type: 'success' },
  MEDIUM: { label: '中风险', type: 'info' },
  HIGH: { label: '高风险', type: 'warning' },
  CRITICAL: { label: '极高风险（禁止借用）', type: 'danger' },
};

// 借用单状态机：
// 申请 -> 借入方导师确认 -> 借出方导师同意 -> 安全员确认转移路线/交接时间 ->
// 库管「组间余流发放」（同步库房发放台账）-> 现场交接 -> 使用中 -> 废液责任拆回实际使用项目 -> 闭环
export enum BorrowStatus {
  PENDING_BORROWER_ADVISOR = 'PENDING_BORROWER_ADVISOR',
  PENDING_LENDER_ADVISOR = 'PENDING_LENDER_ADVISOR',
  PENDING_SAFETY = 'PENDING_SAFETY',
  DISPENSE_READY = 'DISPENSE_READY',
  TRANSFER_PLANNED = 'TRANSFER_PLANNED',
  HANDED_OVER = 'HANDED_OVER',
  IN_USE = 'IN_USE',
  USAGE_LOGGED = 'USAGE_LOGGED',
  WASTE_ASSIGNED = 'WASTE_ASSIGNED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// 借用审批节点
export enum BorrowApprover {
  BORROWER_ADVISOR = 'borrower_advisor',
  LENDER_ADVISOR = 'lender_advisor',
  SAFETY = 'safety',
}

// 借用复盘的三个风险来源（防止借用记录和废液记录分离后无法归因）
export const BORROW_RISK_SOURCES = ['借用本身', '转移过程', '实际使用'] as const;

// 借用复盘结论
export const REVIEW_PHASE_MAP: Record<string, string> = {
  apply: '提交借用申请',
  borrowerAdvisor: '借入方导师确认',
  lenderAdvisor: '借出方导师同意',
  safety: '安全员确认路线与交接时间',
  dispense: '库房发放同步',
  handover: '现场交接',
  handoverIssue: '现场发现问题',
  usage: '实际使用',
  waste: '废液责任拆回',
  close: '闭环复盘',
};

// 危险类别 -> 危险等级分值（用于跨课题组比较试剂危险等级）
export const DANGER_RANK: Record<string, number> = {
  普通: 0,
  强腐蚀: 1,
  低温保存: 1,
  易制爆: 2,
  易制毒: 2,
  剧毒: 4,
};

// 各危险类别要求的最低危险化学品资质（「双方导师权限」比较），持有更高等级资质可向下覆盖
export const CLEARANCE_RANK: Record<string, number> = {
  普通: 0,
  低温保存: 1,
  强腐蚀: 1,
  易制毒: 2,
  易制爆: 2,
  剧毒: 4,
};

// 类别 -> 所需最低资质等级
export const CLEARANCE_BY_CATEGORY: Record<string, string[]> = {
  剧毒: ['剧毒'],
  易制爆: ['易制爆', '剧毒'],
  易制毒: ['易制毒', '剧毒'],
  强腐蚀: ['强腐蚀', '易制毒', '易制爆', '剧毒'],
  低温保存: ['低温保存', '剧毒'],
};

export function dangerRankOf(categories: string[]): number {
  if (!categories || categories.length === 0) return 0;
  return Math.max(...categories.map((c) => DANGER_RANK[c] ?? 1));
}

export function clearanceRankOf(clearance: string[]): number {
  if (!clearance || clearance.length === 0) return 0;
  return Math.max(...clearance.map((c) => CLEARANCE_RANK[c] ?? 0));
}

// 某导师/学生的危化品资质是否覆盖一组危险类别
export function hasClearance(clearance: string[], categories: string[]): boolean {
  const rank = clearanceRankOf(clearance || []);
  for (const c of categories || []) {
    const need = CLEARANCE_BY_CATEGORY[c];
    if (!need) continue; // 普通类别不限制
    // 持有任一允许资质即可（取可替代资质中的最低等级作为门槛）
    const needRank = Math.min(...need.map((x) => CLEARANCE_RANK[x] ?? 0));
    if (rank < needRank) return false;
  }
  return true;
}

// 保存条件可比性：借入方实验室保存设施是否覆盖试剂要求（低温/避光/专柜等）
export function storageCompatible(required: string, borrowerFacility: string): boolean {
  if (!required) return true;
  if (!borrowerFacility) return false;
  const need = ['低温', '避光', '干燥', '专柜', '双锁', '通风', '阴凉'].filter((k) => required.includes(k));
  return need.every((k) => borrowerFacility.includes(k));
}

// 从房间/位置文本提取楼层（化学楼301 -> 3；化学楼3层 -> 3；一层 -> 1）
export function floorOf(location?: string | null): string {
  if (!location) return '';
  const cn: Record<string, string> = { 一: '1', 二: '2', 两: '2', 三: '3', 四: '4', 五: '5', 六: '6' };
  const m1 = location.match(/([一二两三四五六])层/);
  if (m1) return cn[m1[1]] || m1[1];
  const m2 = location.match(/(\d)\s*层/);
  if (m2) return m2[1];
  // 房间号：楼层通常是百位（301->3，B205->2）
  const m3 = location.match(/[A-Za-z]?(\d)\d{2}(?:\D|$)/);
  if (m3) return m3[1];
  return '';
}

export function sameFloor(a?: string | null, b?: string | null): boolean {
  const fa = floorOf(a);
  const fb = floorOf(b);
  return !!fa && !!fb && fa === fb;
}

// 借用风险研判：五要素（危险等级 / 开封日期 / 保存条件 / 借用量 / 双方导师权限）
export interface BorrowRiskInput {
  categories: string[]; // 试剂危险类别
  opened: boolean; // 批次是否已开封
  openedDaysAgo?: number | null; // 开封至今天数
  storageRequired: string; // 试剂保存条件
  borrowerFacility: string; // 借入方实验室保存设施
  amount: number; // 借用量
  maxSingleAmount?: number | null; // 目录单次限量
  lenderClearance: string[]; // 借出方导师资质
  borrowerAdvisorClearance: string[]; // 借入方导师资质
  studentClearance: string[]; // 借入学生资质
  sameBuildingFloor: boolean; // 是否同楼层
}

export interface BorrowRiskResult {
  level: BorrowRiskLevel;
  blocked: boolean; // 硬阻断：禁止发起/通过
  factors: { key: string; label: string; pass: boolean; detail: string }[];
}

export function assessBorrowRisk(i: BorrowRiskInput): BorrowRiskResult {
  const factors: BorrowRiskResult['factors'] = [];
  const rank = dangerRankOf(i.categories);

  // 1. 危险等级
  const isToxic = i.categories.includes('剧毒');
  factors.push({
    key: 'danger',
    label: '试剂危险等级',
    pass: !isToxic,
    detail: isToxic
      ? '剧毒试剂禁止跨课题组借用，须走库房专柜双人双锁流程'
      : i.categories.length
        ? `危险等级 ${rank} 级（${i.categories.join('、')}），允许借用但需双人交接`
        : '普通试剂（0 级）',
  });

  // 2. 开封日期：已开封试剂转移存在变质/污染/计量争议风险（30 天内允许但风险上调，超期硬阻断）
  const openedFresh = !i.opened || (i.openedDaysAgo ?? 0) <= 30;
  factors.push({
    key: 'opened',
    label: '开封日期',
    pass: openedFresh,
    detail: i.opened
      ? `批次已开封${i.openedDaysAgo != null ? ` ${i.openedDaysAgo} 天` : ''}，${openedFresh ? '在 30 天安全期内，允许借用但风险上调至高风险' : '超过 30 天，禁止跨组转移'}`
      : '未开封批次，可整瓶转移',
  });

  // 3. 保存条件
  const storageOk = storageCompatible(i.storageRequired, i.borrowerFacility);
  factors.push({
    key: 'storage',
    label: '保存条件',
    pass: storageOk,
    detail: storageOk
      ? `借入方实验室具备「${i.storageRequired}」保存条件`
      : `借入方实验室不满足「${i.storageRequired}」保存要求，禁止借用`,
  });

  // 4. 借用量
  const overLimit = i.maxSingleAmount != null && i.amount > i.maxSingleAmount;
  factors.push({
    key: 'amount',
    label: '借用量',
    pass: !overLimit,
    detail: overLimit
      ? `借用 ${i.amount} 超过目录单次限量 ${i.maxSingleAmount}，禁止借用`
      : `借用 ${i.amount}${i.maxSingleAmount != null ? `（限量 ${i.maxSingleAmount}）` : ''}`,
  });

  // 5. 双方导师权限
  const lenderOk = hasClearance(i.lenderClearance, i.categories);
  const advisorOk = hasClearance(i.borrowerAdvisorClearance, i.categories);
  const studentOk = hasClearance(i.studentClearance, i.categories);
  factors.push({
    key: 'clearance',
    label: '双方导师权限',
    pass: lenderOk && advisorOk && studentOk,
    detail: `借出方导师${lenderOk ? '✓' : '✗资质不足'} / 借入方导师${advisorOk ? '✓' : '✗资质不足'} / 借入学生${studentOk ? '✓' : '✗专项培训缺失'}`,
  });

  // 6. 同楼层（平台仅允许向同楼层实验室发起借用）
  factors.push({
    key: 'floor',
    label: '同楼层限制',
    pass: i.sameBuildingFloor,
    detail: i.sameBuildingFloor ? '借出/借入实验室在同一楼层，允许短距离转移' : '仅允许向同楼层实验室借用，跨楼层禁止',
  });

  const blocked = factors.some((f) => !f.pass);

  // 综合风险等级
  let level = BorrowRiskLevel.LOW;
  if (isToxic) level = BorrowRiskLevel.CRITICAL;
  else if (rank >= 2 || i.opened) level = BorrowRiskLevel.HIGH;
  else if (rank === 1) level = BorrowRiskLevel.MEDIUM;
  if (!i.sameBuildingFloor) level = BorrowRiskLevel.CRITICAL;
  return { level, blocked, factors };
}
