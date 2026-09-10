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
