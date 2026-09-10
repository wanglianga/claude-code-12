// 全部数据表实体（扁平 FK 设计，服务层手工关联，避免循环依赖）
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column()
  role: string; // student/advisor/safety_officer/warehouse_manager/college_admin/admin

  @Column({ nullable: true })
  college: string;

  @Column({ nullable: true })
  researchGroup: string;

  // 实验室房间/位置（借用「同楼层」研判用，如：化学楼301）
  @Column({ nullable: true })
  labLocation: string;

  // 实验室保存设施（通风橱/避光柜/低温冰箱/专柜双人双锁 等，保存条件研判用）
  @Column({ nullable: true })
  labFacility: string;

  // 危化品资质等级（普通/强腐蚀/低温保存/易制毒/易制爆/剧毒），用于借用双方导师权限比较
  @Column({ type: 'jsonb', default: [] })
  dangerClearance: string[];

  @Column({ nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('training_records')
export class TrainingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column()
  courseName: string;

  @Column({ type: 'date' })
  passedAt: string;

  @Column({ type: 'date' })
  validUntil: string;

  @Column({ nullable: true })
  certificateNo: string;
}

@Entity('reagent_catalog')
export class ReagentCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  casNo: string;

  @Column({ type: 'jsonb', default: [] })
  dangerCategories: string[]; // 易制毒/易制爆/剧毒/强腐蚀/低温保存

  @Column({ nullable: true })
  storageCondition: string;

  @Column({ default: 'ml' })
  unit: string;

  @Column({ type: 'double precision', nullable: true })
  maxSingleAmount: number; // 单次领用上限

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  managerName: string;
}

@Entity('inventory_batches')
export class InventoryBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  reagentId: string;

  @Column()
  reagentName: string;

  @Column()
  warehouseId: string;

  @Column()
  warehouseName: string;

  @Column()
  batchNo: string; // 批号

  @Column({ type: 'double precision' })
  totalAmount: number;

  @Column({ type: 'double precision' })
  remainingAmount: number; // 余量

  @Column({ default: 'ml' })
  unit: string;

  @Column({ type: 'date' })
  expiryDate: string; // 有效期

  @Column({ default: false })
  opened: boolean; // 开封状态

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date;

  @Column({ default: '在库' })
  status: string; // 在库/用尽/过期锁定

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('fume_hoods')
export class FumeHood {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: '正常' })
  status: string; // 正常/故障
}

@Entity('requisitions')
export class Requisition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reqNo: string;

  // 来源：NORMAL 库房正常领用；BORROW 跨课题组借用自动生成的实际使用单
  @Column({ default: 'NORMAL' })
  sourceType: string;

  // sourceType=BORROW 时关联的借用单
  @Index()
  @Column({ nullable: true })
  borrowId: string;

  @Index()
  @Column()
  studentId: string;

  @Column()
  studentName: string;

  @Column({ nullable: true })
  college: string; // 学院（责任视图维度）

  @Column({ nullable: true })
  researchGroup: string; // 课题组（责任视图维度）

  @Column()
  projectName: string; // 实验项目

  @Column()
  advisorId: string;

  @Column()
  advisorName: string;

  @Column()
  reagentId: string;

  @Column()
  reagentName: string;

  @Column({ nullable: true })
  casNo: string;

  @Column()
  concentration: string; // 浓度

  @Column({ type: 'double precision' })
  estimatedAmount: number; // 预计用量

  @Column({ default: 'ml' })
  unit: string;

  @Column()
  location: string; // 实验地点

  @Column({ type: 'timestamp' })
  plannedStart: Date; // 操作时间

  @Column({ type: 'timestamp' })
  plannedEnd: Date;

  @Column({ type: 'text', nullable: true })
  teamMembers: string; // 同组人员

  @Column({ type: 'jsonb', default: [] })
  dangerCategories: string[]; // 申请时自动判定快照

  @Column({ default: false })
  requiresDualPickup: boolean; // 是否双人领取

  @Column({ type: 'double precision', nullable: true })
  maxSingleAmount: number; // 单次领用限量

  @Column({ nullable: true })
  fumeHoodId: string;

  @Column({ nullable: true })
  fumeHoodCode: string; // 预约通风橱

  @Column({ type: 'jsonb', nullable: true })
  safetyChecklist: Record<string, boolean>; // 安全员核查项

  @Index()
  @Column({ default: 'PENDING_ADVISOR' })
  status: string;

  @Column({ type: 'text', nullable: true })
  rejectReason: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requisitionId: string;

  @Column()
  approverId: string;

  @Column()
  approverName: string;

  @Column()
  role: string; // advisor / safety_officer

  @Column()
  action: string; // approve / reject

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  checks: Record<string, boolean>; // 安全员核查快照

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('dispense_records')
export class DispenseRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  requisitionId: string;

  // 来源：WAREHOUSE 库房正常发放；GROUP_BORROW 组间余流发放（跨组借用）
  @Column({ default: 'WAREHOUSE' })
  sourceType: string;

  @Column({ nullable: true })
  borrowId: string;

  @Column()
  batchId: string;

  @Column()
  batchNo: string; // 批号

  @Column()
  warehouseName: string;

  @Column({ type: 'double precision' })
  amount: number; // 发放量

  @Column({ type: 'double precision' })
  remainingAfter: number; // 出库后余量

  @Column({ default: 'ml' })
  unit: string;

  @Column({ type: 'date' })
  expiryDate: string; // 有效期快照

  @Column({ default: false })
  opened: boolean; // 开封状态

  @Column()
  pickerName: string; // 领取人身份

  @Column({ nullable: true })
  secondPickerName: string; // 双人领取第二人

  @Column()
  keeperId: string;

  @Column()
  keeperName: string;

  @CreateDateColumn()
  dispensedAt: Date;
}

@Entity('usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requisitionId: string;

  @Column({ type: 'double precision' })
  actualAmount: number; // 实际用量

  @Column({ type: 'double precision' })
  remainingAmount: number; // 剩余量

  @Column({ default: 'ml' })
  unit: string;

  @Column({ type: 'text', nullable: true })
  spillDesc: string; // 异常洒漏描述

  @Column({ nullable: true })
  wasteType: string; // 产生废液类型

  @Column({ type: 'double precision', nullable: true })
  wasteAmount: number;

  @Column({ default: false })
  fumeHoodFault: boolean; // 通风橱故障

  @Column()
  loggedById: string;

  @Column()
  loggedByName: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('waste_barrels')
export class WasteBarrel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  wasteType: string;

  @Column({ type: 'double precision' })
  capacity: number;

  @Column({ type: 'double precision', default: 0 })
  currentAmount: number;

  @Column({ default: 'ml' })
  unit: string;

  @Column({ nullable: true })
  warehouseName: string;

  @Column({ default: '在用' })
  status: string; // 在用/即将满载/已满

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('waste_records')
export class WasteRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requisitionId: string;

  @Column()
  reqNo: string;

  @Column()
  reagentName: string; // 匹配原试剂

  @Column()
  projectName: string; // 匹配实验项目

  @Column()
  wasteType: string;

  @Column({ type: 'double precision' })
  amount: number;

  @Column({ default: 'ml' })
  unit: string;

  @Column()
  barrelId: string;

  @Column()
  barrelCode: string;

  @Column()
  containerLabel: string; // 容器标签

  // ===== 借用溯源：废液责任拆回实际使用项目，防止借用记录与废液记录分离 =====
  // 废液责任课题组（实际使用方 = 借入方课题组），即使试剂来自借出方课题组
  @Column({ nullable: true })
  responsibleGroupName: string;

  // 试剂来源课题组（借出方），用于复盘区分「来源」与「责任」
  @Column({ nullable: true })
  sourceGroupName: string;

  @Column({ default: 'NORMAL' })
  sourceType: string; // NORMAL / BORROW

  @Index()
  @Column({ nullable: true })
  borrowId: string;

  @Column()
  storedById: string;

  @Column()
  storedByName: string;

  @Column({ default: 'STORED' })
  status: string; // STORED/TRANSFERRED

  @Column({ nullable: true })
  manifestId: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('transfer_manifests')
export class TransferManifest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  manifestNo: string;

  @Column()
  company: string; // 危废处置公司

  @Column({ type: 'double precision' })
  totalWeight: number; // 称重 kg

  @Column({ type: 'jsonb', default: [] })
  photoUrls: string[]; // 交接照片

  @Column({ default: 'PENDING_REVIEW' })
  status: string;

  @Column()
  createdById: string;

  @Column()
  createdByName: string;

  @Column({ nullable: true })
  reviewerId: string;

  @Column({ nullable: true })
  reviewerName: string;

  @Column({ type: 'text', nullable: true })
  reviewComment: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('anomalies')
export class Anomaly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string; // AnomalyType

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ default: 'OPEN' })
  status: string;

  @Index()
  @Column({ nullable: true })
  requisitionId: string;

  @Column({ nullable: true })
  reqNo: string;

  @Column({ nullable: true })
  barrelId: string;

  @Column({ nullable: true })
  batchId: string;

  @Column({ nullable: true })
  usageLogId: string;

  // 借用溯源：借用相关风险事件关联的借用单
  @Index()
  @Column({ nullable: true })
  borrowId: string;

  // 借用风险来源分类：借用本身 / 转移过程 / 实际使用（复盘归因）
  @Column({ nullable: true })
  riskSource: string;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ nullable: true })
  resolvedById: string;

  @Column({ nullable: true })
  resolvedByName: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

// ==================== 跨课题组借用 ====================

// 课题组暂存试剂（已从库房领出、存放于本组实验室、可向同楼层他组借出的余量）
@Entity('group_reagent_stocks')
export class GroupReagentStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  researchGroup: string; // 持有课题组（借出方）

  @Column({ nullable: true })
  college: string;

  @Column()
  labLocation: string; // 存放房间（同楼层研判用，如 化学楼301）

  @Column()
  reagentId: string;

  @Column()
  reagentName: string;

  @Column({ nullable: true })
  casNo: string;

  @Column({ type: 'jsonb', default: [] })
  dangerCategories: string[];

  @Column({ nullable: true })
  storageCondition: string; // 保存条件

  @Column({ default: 'ml' })
  unit: string;

  @Column({ type: 'double precision', nullable: true })
  maxSingleAmount: number;

  // 暂存来源：库房批次号（可追溯）
  @Column()
  sourceBatchNo: string;

  @Column({ type: 'double precision' })
  totalAmount: number; // 组内领入量

  @Column({ type: 'double precision' })
  remainingAmount: number; // 当前可借/可用余量

  @Column({ default: false })
  opened: boolean;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date;

  @Column({ type: 'date' })
  expiryDate: string;

  // 本组导师对该批试剂的危化品资质（快照）
  @Column({ type: 'jsonb', default: [] })
  holderClearance: string[];

  @Column({ default: '在用' })
  status: string; // 在用/冻结/用尽

  @CreateDateColumn()
  createdAt: Date;
}

// 跨课题组借用申请单
@Entity('borrow_requests')
export class BorrowRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  borrowNo: string;

  // ---- 借入方（实际使用项目）----
  @Index()
  @Column()
  borrowerStudentId: string;
  @Column()
  borrowerStudentName: string;
  @Column()
  borrowerCollege: string;
  @Column()
  borrowerGroup: string; // 实际使用课题组 = 废液责任课题组
  @Column()
  borrowerLabLocation: string;
  @Column()
  borrowerAdvisorId: string;
  @Column()
  borrowerAdvisorName: string;
  @Column({ type: 'jsonb', default: [] })
  borrowerAdvisorClearance: string[];
  @Column({ type: 'jsonb', default: [] })
  borrowerStudentClearance: string[];

  // ---- 借出方 ----
  @Index()
  @Column()
  lenderGroup: string;
  @Column()
  lenderCollege: string;
  @Column()
  lenderLabLocation: string;
  @Column()
  lenderAdvisorId: string;
  @Column()
  lenderAdvisorName: string;
  @Column({ type: 'jsonb', default: [] })
  lenderClearance: string[];

  // ---- 试剂与五要素快照 ----
  @Column()
  stockId: string;
  @Column()
  reagentId: string;
  @Column()
  reagentName: string;
  @Column({ nullable: true })
  casNo: string;
  @Column({ type: 'jsonb', default: [] })
  dangerCategories: string[];
  @Column({ nullable: true })
  storageCondition: string;
  @Column({ default: 'ml' })
  unit: string;
  @Column({ type: 'double precision', nullable: true })
  maxSingleAmount: number;
  @Column({ type: 'double precision' })
  amount: number; // 借用量
  @Column()
  sourceBatchNo: string;
  @Column({ default: false })
  opened: boolean; // 借用时批次开封状态
  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date;
  @Column({ type: 'date' })
  expiryDate: string;

  // ---- 实际使用项目（废液责任锚点）----
  @Column()
  projectName: string;
  @Column({ nullable: true })
  purpose: string;

  // ---- 风险研判快照 ----
  @Column()
  riskLevel: string; // BorrowRiskLevel
  @Column({ type: 'jsonb', default: [] })
  riskFactors: Record<string, any>[];
  @Column({ default: false })
  blocked: boolean;
  @Column({ type: 'text', nullable: true })
  riskSummary: string;

  // ---- 安全员确认的转移路线与交接时间 ----
  @Column({ type: 'text', nullable: true })
  transferRoute: string; // 转移路线（起止房间、途经电梯/走廊、转运容器）
  @Column({ nullable: true })
  transferContainer: string; // 防泄漏转运容器
  @Column({ type: 'timestamp', nullable: true })
  handoverTime: Date; // 交接时间
  @Column({ nullable: true })
  handoverLocation: string; // 交接地点
  @Column({ nullable: true })
  safetyOfficerId: string;
  @Column({ nullable: true })
  safetyOfficerName: string;

  // ---- 现场交接（库管/安全员监督，双方签字）----
  @Column({ type: 'timestamp', nullable: true })
  handedOverAt: Date;
  @Column({ nullable: true })
  handoverBorrowerName: string; // 借入方接收人
  @Column({ nullable: true })
  handoverLenderName: string; // 借出方交出人
  @Column({ nullable: true })
  handoverKeeperId: string;
  @Column({ nullable: true })
  handoverKeeperName: string;
  @Column({ default: false })
  dualHandover: boolean; // 危险试剂双人交接

  // 交接时同步生成的「实际使用单」，复用使用登记/废液链路
  @Column({ nullable: true })
  usageRequisitionId: string;

  // ---- 使用与废液拆回 ----
  @Column({ type: 'double precision', nullable: true })
  usedAmount: number;
  @Column({ type: 'double precision', nullable: true })
  returnedAmount: number; // 余量归还
  @Column({ type: 'double precision', nullable: true })
  wasteAmount: number;
  @Column({ nullable: true })
  wasteType: string;

  // ---- 复盘（安全员：风险来自借用本身/转移过程/实际使用）----
  @Column({ nullable: true })
  reviewRiskSource: string; // 借用本身 / 转移过程 / 实际使用
  @Column({ type: 'text', nullable: true })
  reviewConclusion: string;
  @Column({ nullable: true })
  reviewById: string;
  @Column({ nullable: true })
  reviewByName: string;
  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Index()
  @Column({ default: 'PENDING_BORROWER_ADVISOR' })
  status: string; // BorrowStatus

  @Column({ type: 'text', nullable: true })
  rejectReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 借用审批 / 交接流水（借入方导师 -> 借出方导师 -> 安全员 -> 交接）
@Entity('borrow_approvals')
export class BorrowApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  borrowId: string;

  @Column()
  node: string; // BorrowApprover / handover / dispense / review
  @Column()
  nodeLabel: string;

  @Column()
  actorId: string;
  @Column()
  actorName: string;
  @Column()
  actorRole: string;

  @Column()
  action: string; // approve / reject / plan / dispense / handover / return / review

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, any>; // 路线/交接时间/容器/签字人等快照

  @CreateDateColumn()
  createdAt: Date;
}
