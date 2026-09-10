import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  Anomaly,
  Approval,
  BorrowApproval,
  BorrowRequest,
  DispenseRecord,
  FumeHood,
  GroupReagentStock,
  InventoryBatch,
  ReagentCatalog,
  Requisition,
  TrainingRecord,
  TransferManifest,
  UsageLog,
  User,
  WasteBarrel,
  WasteRecord,
  Warehouse,
} from '../common/entities';
import { AnomalyType, BorrowApprover, BorrowStatus, ManifestStatus, ReqStatus, Role, WasteStatus } from '../common/enums';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private log = new Logger('Seed');

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(TrainingRecord) private trainings: Repository<TrainingRecord>,
    @InjectRepository(ReagentCatalog) private catalog: Repository<ReagentCatalog>,
    @InjectRepository(Warehouse) private warehouses: Repository<Warehouse>,
    @InjectRepository(InventoryBatch) private batches: Repository<InventoryBatch>,
    @InjectRepository(FumeHood) private hoods: Repository<FumeHood>,
    @InjectRepository(WasteBarrel) private barrels: Repository<WasteBarrel>,
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
    @InjectRepository(Approval) private approvals: Repository<Approval>,
    @InjectRepository(DispenseRecord) private dispenses: Repository<DispenseRecord>,
    @InjectRepository(UsageLog) private usageLogs: Repository<UsageLog>,
    @InjectRepository(WasteRecord) private wasteRecords: Repository<WasteRecord>,
    @InjectRepository(TransferManifest) private manifests: Repository<TransferManifest>,
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    @InjectRepository(GroupReagentStock) private groupStocks: Repository<GroupReagentStock>,
    @InjectRepository(BorrowRequest) private borrows: Repository<BorrowRequest>,
    @InjectRepository(BorrowApproval) private borrowApprovals: Repository<BorrowApproval>,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_DEMO === 'false') return;
    const count = await this.users.count();
    if (count > 0) return;
    this.log.log('初始化演示数据...');
    await this.seed();
    this.log.log('演示数据初始化完成');
  }

  private async seed() {
    const hash = (p: string) => bcrypt.hashSync(p, 10);

    // ---------- 用户（测试账号见 README）----------
    // 化学楼三层有三个同楼层课题组：有机合成(301)、分析化学(302)、高分子材料(305)，可互相借用
    const [admin, zhangsan, lisi, wangwu, sunqi, wangprof, liuprof, zhaoprof, safety, keeper, college] =
      await this.users.save([
        this.users.create({ username: 'admin', passwordHash: hash('Admin@12345'), name: '系统管理员', role: Role.ADMIN, college: '实验室与设备管理处' }),
        this.users.create({ username: 'zhangsan', passwordHash: hash('Student@123'), name: '张三', role: Role.STUDENT, college: '化学学院', researchGroup: '有机合成课题组', labLocation: '化学楼301', labFacility: '通风橱、避光柜、低温冰箱、专柜双人双锁', dangerClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'] }),
        this.users.create({ username: 'lisi', passwordHash: hash('Student@123'), name: '李四', role: Role.STUDENT, college: '化学学院', researchGroup: '分析化学课题组', labLocation: '化学楼302', labFacility: '通风橱、避光柜', dangerClearance: ['强腐蚀'] }),
        this.users.create({ username: 'wangwu', passwordHash: hash('Student@123'), name: '王五', role: Role.STUDENT, college: '材料学院', researchGroup: '功能材料课题组', labLocation: '材料楼201', labFacility: '通风橱、干燥柜', dangerClearance: ['剧毒'] }),
        this.users.create({ username: 'sunqi', passwordHash: hash('Student@123'), name: '孙七', role: Role.STUDENT, college: '化学学院', researchGroup: '高分子材料课题组', labLocation: '化学楼305', labFacility: '通风橱、避光柜、低温冰箱', dangerClearance: ['易制毒', '强腐蚀'] }),
        this.users.create({ username: 'wangprof', passwordHash: hash('Advisor@123'), name: '王建国', role: Role.ADVISOR, college: '化学学院', researchGroup: '有机合成课题组', labLocation: '化学楼301', labFacility: '通风橱、避光柜、低温冰箱、专柜双人双锁', dangerClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'] }),
        this.users.create({ username: 'liuprof', passwordHash: hash('Advisor@123'), name: '刘敏', role: Role.ADVISOR, college: '化学学院', researchGroup: '分析化学课题组', labLocation: '化学楼302', labFacility: '通风橱、避光柜', dangerClearance: ['强腐蚀'] }),
        this.users.create({ username: 'zhaoprof', passwordHash: hash('Advisor@123'), name: '赵宏远', role: Role.ADVISOR, college: '化学学院', researchGroup: '高分子材料课题组', labLocation: '化学楼305', labFacility: '通风橱、避光柜、低温冰箱', dangerClearance: ['易制毒', '强腐蚀'] }),
        this.users.create({ username: 'safety', passwordHash: hash('Safety@123'), name: '陈安全', role: Role.SAFETY, college: '化学学院' }),
        this.users.create({ username: 'keeper', passwordHash: hash('Keeper@123'), name: '赵库管', role: Role.KEEPER, college: '化学学院' }),
        this.users.create({ username: 'college', passwordHash: hash('College@123'), name: '孙主任', role: Role.COLLEGE, college: '化学学院' }),
      ]);

    // ---------- 培训记录（李四已过期，用于演示安全员拦截） ----------
    await this.trainings.save([
      this.trainings.create({ userId: zhangsan.id, courseName: '实验室安全通识培训', passedAt: '2025-09-01', validUntil: '2027-06-30', certificateNo: 'PX-2025-0001' }),
      this.trainings.create({ userId: zhangsan.id, courseName: '危险化学品操作专项', passedAt: '2025-09-15', validUntil: '2027-06-30', certificateNo: 'PX-2025-0058' }),
      this.trainings.create({ userId: lisi.id, courseName: '实验室安全通识培训', passedAt: '2023-09-01', validUntil: '2026-01-01', certificateNo: 'PX-2023-0112' }),
      this.trainings.create({ userId: wangwu.id, courseName: '实验室安全通识培训', passedAt: '2026-03-01', validUntil: '2028-03-01', certificateNo: 'PX-2026-0021' }),
      this.trainings.create({ userId: wangwu.id, courseName: '剧毒试剂专项操作', passedAt: '2026-03-10', validUntil: '2028-03-10', certificateNo: 'PX-2026-0033' }),
    ]);

    // ---------- 试剂目录 ----------
    const cat = (name: string, casNo: string, dangerCategories: string[], unit: string, maxSingleAmount: number, storageCondition: string, description?: string) =>
      this.catalog.create({ name, casNo, dangerCategories, unit, maxSingleAmount, storageCondition, description });
    const [bingtong, yanSuan, liuSuan, xiaoSuan, kmno4, zjsj, kcn, hf, lindan, ethanol] =
      await this.catalog.save([
        cat('丙酮', '67-64-1', ['易制毒'], 'ml', 500, '常温避光', '第三类易制毒化学品'),
        cat('盐酸', '7647-01-0', ['易制毒', '强腐蚀'], 'ml', 500, '常温', '第三类易制毒，强腐蚀'),
        cat('硫酸', '7664-93-9', ['易制毒', '强腐蚀'], 'ml', 250, '常温', '第三类易制毒，强腐蚀'),
        cat('硝酸', '7697-37-2', ['易制爆', '强腐蚀'], 'ml', 250, '常温避光', '易制爆危险化学品'),
        cat('高锰酸钾', '7722-64-7', ['易制毒', '易制爆'], 'g', 100, '常温干燥', '易制毒兼易制爆'),
        cat('重铬酸钾', '7778-50-9', ['易制爆', '剧毒'], 'g', 50, '常温干燥', '易制爆，高毒'),
        cat('氰化钾', '151-50-8', ['剧毒'], 'g', 10, '专柜双人双锁', '剧毒化学品'),
        cat('氢氟酸', '7664-39-3', ['剧毒', '强腐蚀'], 'ml', 100, '低温避光', '剧毒，强腐蚀'),
        cat('液氮', '7727-37-9', ['低温保存'], 'ml', 5000, '低温罐', '低温冻伤风险'),
        cat('无水乙醇', '64-17-5', [], 'ml', 1000, '常温避光', '普通易燃试剂（对照）'),
      ]);

    // ---------- 库房 ----------
    const [whA, whB] = await this.warehouses.save([
      this.warehouses.create({ name: '化学楼危险品库A', location: '化学楼地下一层', managerName: '赵库管' }),
      this.warehouses.create({ name: '低温冷库B', location: '化学楼一层', managerName: '赵库管' }),
    ]);

    // ---------- 库存批次（含一个已过期批次用于触发异常） ----------
    const bat = (
      reagent: ReagentCatalog, warehouse: Warehouse, batchNo: string,
      total: number, remaining: number, expiryDate: string, opened = false,
    ) =>
      this.batches.create({
        reagentId: reagent.id, reagentName: reagent.name,
        warehouseId: warehouse.id, warehouseName: warehouse.name,
        batchNo, totalAmount: total, remainingAmount: remaining,
        unit: reagent.unit, expiryDate, opened, status: '在库',
      });
    const [bBingtong, bYansuan, bLiusuan, bXiaosuan, bKmno4, bKcn, bEthanol] = await this.batches.save([
      bat(bingtong, whA, 'B2025-PA-01', 20000, 18500, '2027-06-30'),
      bat(yanSuan, whA, 'B2026-HCL-01', 10000, 8600, '2027-12-31'),
      bat(liuSuan, whA, 'B2025-HS-02', 5000, 4800, '2026-12-31', true),
      bat(xiaoSuan, whA, 'B2025-XS-01', 2500, 2300, '2026-08-31'), // 已过期（演示日 2026-09-10）
      bat(kmno4, whA, 'B2025-KMO-01', 1000, 950, '2027-03-31'),
      bat(kcn, whA, 'B2024-KCN-01', 500, 480, '2027-01-31'),
      bat(ethanol, whA, 'B2026-ET-01', 10000, 9000, '2028-01-01'),
    ]);
    await this.batches.save([
      bat(zjsj, whA, 'B2025-ZGS-01', 500, 500, '2027-03-31'),
      bat(hf, whA, 'B2025-HF-01', 1000, 1000, '2026-11-30'),
      bat(lindan, whB, 'LN2-2026-09', 50000, 30000, '2026-12-31'),
    ]);

    // ---------- 通风橱（TF-103 故障） ----------
    const [hood101, hood102] = await this.hoods.save([
      this.hoods.create({ code: 'TF-101', location: '化学楼301', status: '正常' }),
      this.hoods.create({ code: 'TF-102', location: '化学楼302', status: '正常' }),
      this.hoods.create({ code: 'TF-103', location: '化学楼303', status: '故障' }),
      this.hoods.create({ code: 'TF-201', location: '化学楼201', status: '正常' }),
    ]);

    // ---------- 废液桶（有机不含卤桶 91% 即将满载） ----------
    const [barrelOrg, barrelHal, barrelAcid, barrelMetal] = await this.barrels.save([
      this.barrels.create({ code: 'WF-ORG-01', wasteType: '有机废液(不含卤)', capacity: 20000, currentAmount: 18200, unit: 'ml', warehouseName: whA.name, status: '即将满载' }),
      this.barrels.create({ code: 'WF-ORG-HAL-01', wasteType: '有机废液(含卤)', capacity: 20000, currentAmount: 5000, unit: 'ml', warehouseName: whA.name, status: '在用' }),
      this.barrels.create({ code: 'WF-ACID-01', wasteType: '无机酸碱废液', capacity: 20000, currentAmount: 8000, unit: 'ml', warehouseName: whA.name, status: '在用' }),
      this.barrels.create({ code: 'WF-METAL-01', wasteType: '含重金属废液', capacity: 10000, currentAmount: 1200, unit: 'ml', warehouseName: whA.name, status: '在用' }),
    ]);

    // ---------- 演示申请单（覆盖各状态） ----------
    let seq = 0;
    const mkReq = (partial: Partial<Requisition>) =>
      this.reqs.create({
        reqNo: `REQ-20260910-${String(++seq).padStart(4, '0')}`,
        ...partial,
      } as Partial<Requisition>);

    // R1 待导师审批
    const r1 = await this.reqs.save(mkReq({
      studentId: zhangsan.id, studentName: '张三', college: '化学学院', researchGroup: '有机合成课题组',
      projectName: '天然产物提取工艺优化', advisorId: wangprof.id, advisorName: '王建国',
      reagentId: bingtong.id, reagentName: '丙酮', casNo: '67-64-1', concentration: '分析纯 ≥99.5%',
      estimatedAmount: 400, unit: 'ml', location: '化学楼301',
      plannedStart: new Date('2026-09-12T09:00:00'), plannedEnd: new Date('2026-09-12T12:00:00'),
      teamMembers: '李四、王五', dangerCategories: ['易制毒'], requiresDualPickup: true, maxSingleAmount: 500,
      status: ReqStatus.PENDING_ADVISOR,
    }));

    // R2 全链路已闭环（硫酸：申请→双审批→出库→使用→废液→转运）
    const r2 = await this.reqs.save(mkReq({
      studentId: zhangsan.id, studentName: '张三', college: '化学学院', researchGroup: '有机合成课题组',
      projectName: '催化反应条件筛选', advisorId: wangprof.id, advisorName: '王建国',
      reagentId: liuSuan.id, reagentName: '硫酸', casNo: '7664-93-9', concentration: '98% 浓硫酸',
      estimatedAmount: 200, unit: 'ml', location: '化学楼301',
      plannedStart: new Date('2026-09-01T09:00:00'), plannedEnd: new Date('2026-09-01T17:00:00'),
      teamMembers: '李四', dangerCategories: ['易制毒', '强腐蚀'], requiresDualPickup: true, maxSingleAmount: 250,
      fumeHoodId: hood101.id, fumeHoodCode: 'TF-101',
      safetyChecklist: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true },
      status: ReqStatus.CLOSED,
    }));
    await this.approvals.save([
      this.approvals.create({ requisitionId: r2.id, approverId: wangprof.id, approverName: '王建国', role: 'advisor', action: 'approve', comment: '实验必要，同意' }),
      this.approvals.create({ requisitionId: r2.id, approverId: safety.id, approverName: '陈安全', role: 'safety_officer', action: 'approve', comment: '培训/防护/通风橱/库存均符合', checks: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true } }),
    ]);
    await this.dispenses.save(this.dispenses.create({
      requisitionId: r2.id, batchId: bLiusuan.id, batchNo: bLiusuan.batchNo, warehouseName: whA.name,
      amount: 200, remainingAfter: 4600, unit: 'ml', expiryDate: bLiusuan.expiryDate, opened: true,
      pickerName: '张三', secondPickerName: '李四', keeperId: keeper.id, keeperName: '赵库管',
    }));
    await this.usageLogs.save(this.usageLogs.create({
      requisitionId: r2.id, actualAmount: 180, remainingAmount: 20, unit: 'ml',
      wasteType: '无机酸碱废液', wasteAmount: 200, loggedById: zhangsan.id, loggedByName: '张三',
    }));
    const w2 = await this.wasteRecords.save(this.wasteRecords.create({
      requisitionId: r2.id, reqNo: r2.reqNo, reagentName: '硫酸', projectName: '催化反应条件筛选',
      wasteType: '无机酸碱废液', amount: 200, unit: 'ml', barrelId: barrelAcid.id, barrelCode: barrelAcid.code,
      containerLabel: '废酸-硫酸-20260901', storedById: keeper.id, storedByName: '赵库管',
      status: WasteStatus.TRANSFERRED,
    }));
    const m1 = await this.manifests.save(this.manifests.create({
      manifestNo: 'TRF-20260905-0001', company: '绿源危废处置有限公司', totalWeight: 25.6,
      photoUrls: ['handover-20260905-01.jpg', 'handover-20260905-02.jpg'],
      status: ManifestStatus.TRANSFERRED, createdById: keeper.id, createdByName: '赵库管',
      reviewerId: college.id, reviewerName: '孙主任', reviewComment: '称重与标签核对无误，同意转运', reviewedAt: new Date('2026-09-05T10:00:00'),
    }));
    w2.manifestId = m1.id;
    await this.wasteRecords.save(w2);

    // R3 待安全员审批（李四培训过期 + 硝酸批次已过期，演示拦截）
    const r3 = await this.reqs.save(mkReq({
      studentId: lisi.id, studentName: '李四', college: '化学学院', researchGroup: '分析化学课题组',
      projectName: '金属表面处理工艺研究', advisorId: liuprof.id, advisorName: '刘敏',
      reagentId: xiaoSuan.id, reagentName: '硝酸', casNo: '7697-37-2', concentration: '65% 硝酸',
      estimatedAmount: 100, unit: 'ml', location: '化学楼302',
      plannedStart: new Date('2026-09-15T14:00:00'), plannedEnd: new Date('2026-09-15T17:00:00'),
      teamMembers: '张三', dangerCategories: ['易制爆', '强腐蚀'], requiresDualPickup: true, maxSingleAmount: 250,
      status: ReqStatus.PENDING_SAFETY,
    }));
    await this.approvals.save(this.approvals.create({
      requisitionId: r3.id, approverId: liuprof.id, approverName: '刘敏', role: 'advisor', action: 'approve', comment: '课题需要，同意',
    }));

    // R4 已审批待出库（剧毒氰化钾，双人领取）
    const r4 = await this.reqs.save(mkReq({
      studentId: wangwu.id, studentName: '王五', college: '材料学院', researchGroup: '功能材料课题组',
      projectName: '电镀液配制与性能研究', advisorId: wangprof.id, advisorName: '王建国',
      reagentId: kcn.id, reagentName: '氰化钾', casNo: '151-50-8', concentration: '分析纯',
      estimatedAmount: 5, unit: 'g', location: '化学楼201',
      plannedStart: new Date('2026-09-11T09:00:00'), plannedEnd: new Date('2026-09-11T11:00:00'),
      teamMembers: '张三', dangerCategories: ['剧毒'], requiresDualPickup: true, maxSingleAmount: 10,
      fumeHoodId: hood102.id, fumeHoodCode: 'TF-102',
      safetyChecklist: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true },
      status: ReqStatus.APPROVED,
    }));
    await this.approvals.save([
      this.approvals.create({ requisitionId: r4.id, approverId: wangprof.id, approverName: '王建国', role: 'advisor', action: 'approve', comment: '电镀实验必需' }),
      this.approvals.create({ requisitionId: r4.id, approverId: safety.id, approverName: '陈安全', role: 'safety_officer', action: 'approve', comment: '剧毒试剂，限 10g 双人领取', checks: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true } }),
    ]);

    // R5 已出库使用中（高锰酸钾，双人已领）
    const r5 = await this.reqs.save(mkReq({
      studentId: zhangsan.id, studentName: '张三', college: '化学学院', researchGroup: '有机合成课题组',
      projectName: '氧化反应机理探究', advisorId: wangprof.id, advisorName: '王建国',
      reagentId: kmno4.id, reagentName: '高锰酸钾', casNo: '7722-64-7', concentration: '分析纯',
      estimatedAmount: 80, unit: 'g', location: '化学楼301',
      plannedStart: new Date('2026-09-09T09:00:00'), plannedEnd: new Date('2026-09-12T17:00:00'),
      teamMembers: '李四', dangerCategories: ['易制毒', '易制爆'], requiresDualPickup: true, maxSingleAmount: 100,
      fumeHoodId: hood101.id, fumeHoodCode: 'TF-101',
      safetyChecklist: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true },
      status: ReqStatus.IN_USE,
    }));
    await this.approvals.save([
      this.approvals.create({ requisitionId: r5.id, approverId: wangprof.id, approverName: '王建国', role: 'advisor', action: 'approve' }),
      this.approvals.create({ requisitionId: r5.id, approverId: safety.id, approverName: '陈安全', role: 'safety_officer', action: 'approve', checks: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true } }),
    ]);
    await this.dispenses.save(this.dispenses.create({
      requisitionId: r5.id, batchId: bKmno4.id, batchNo: bKmno4.batchNo, warehouseName: whA.name,
      amount: 80, remainingAfter: 870, unit: 'g', expiryDate: bKmno4.expiryDate, opened: true,
      pickerName: '张三', secondPickerName: '李四', keeperId: keeper.id, keeperName: '赵库管',
    }));
    bKmno4.remainingAmount = 870;
    bKmno4.opened = true;
    await this.batches.save(bKmno4);

    // R6 使用登记完成（盐酸，实际用量超申请 -> 已产生待处理异常）
    const r6 = await this.reqs.save(mkReq({
      studentId: zhangsan.id, studentName: '张三', college: '化学学院', researchGroup: '有机合成课题组',
      projectName: '样品前处理酸解实验', advisorId: wangprof.id, advisorName: '王建国',
      reagentId: yanSuan.id, reagentName: '盐酸', casNo: '7647-01-0', concentration: '36% 盐酸',
      estimatedAmount: 300, unit: 'ml', location: '化学楼301',
      plannedStart: new Date('2026-09-08T09:00:00'), plannedEnd: new Date('2026-09-08T17:00:00'),
      teamMembers: '李四', dangerCategories: ['易制毒', '强腐蚀'], requiresDualPickup: true, maxSingleAmount: 500,
      fumeHoodId: hood101.id, fumeHoodCode: 'TF-101',
      safetyChecklist: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true },
      status: ReqStatus.USAGE_LOGGED,
    }));
    await this.approvals.save([
      this.approvals.create({ requisitionId: r6.id, approverId: wangprof.id, approverName: '王建国', role: 'advisor', action: 'approve' }),
      this.approvals.create({ requisitionId: r6.id, approverId: safety.id, approverName: '陈安全', role: 'safety_officer', action: 'approve', checks: { trainingOk: true, ppeOk: true, fumeHoodOk: true, teamOk: true, inventoryOk: true } }),
    ]);
    await this.dispenses.save(this.dispenses.create({
      requisitionId: r6.id, batchId: bYansuan.id, batchNo: bYansuan.batchNo, warehouseName: whA.name,
      amount: 300, remainingAfter: 8300, unit: 'ml', expiryDate: bYansuan.expiryDate, opened: true,
      pickerName: '张三', secondPickerName: '李四', keeperId: keeper.id, keeperName: '赵库管',
    }));
    bYansuan.remainingAmount = 8300;
    bYansuan.opened = true;
    await this.batches.save(bYansuan);
    const u6 = await this.usageLogs.save(this.usageLogs.create({
      requisitionId: r6.id, actualAmount: 350, remainingAmount: 0, unit: 'ml',
      wasteType: '无机酸碱废液', wasteAmount: 350, loggedById: zhangsan.id, loggedByName: '张三',
    }));

    // ---------- 待处理异常 ----------
    await this.anomalies.save([
      this.anomalies.create({
        type: AnomalyType.OVER_USAGE, requisitionId: r6.id, reqNo: r6.reqNo, usageLogId: u6.id,
        description: '实际用量 350ml 超过申请量 300ml（盐酸）', status: 'OPEN',
      }),
      this.anomalies.create({
        type: AnomalyType.BARREL_NEAR_FULL, barrelId: barrelOrg.id,
        description: '废液桶 WF-ORG-01（有机废液(不含卤)）液位 91%，即将满载，请安排转运', status: 'OPEN',
      }),
    ]);

    // ==================== 跨课题组借用演示数据 ====================
    // 化学楼三层三个同楼层课题组：有机合成301(王建国)、分析化学302(刘敏)、高分子材料305(赵宏远)
    const mkStock = (s: Partial<GroupReagentStock>) => this.groupStocks.create({
      college: '化学学院', unit: 'ml', status: '在用', totalAmount: 0, ...s,
    } as Partial<GroupReagentStock>);

    const [gAcetone301, gSulfuric301, gEthanol302, gHCl305, gAcetone302, gEthanol305, gHF301] =
      await this.groupStocks.save([
        // 有机合成301 暂存：丙酮(未开封)、硫酸(已开封16天，安全期内)、氢氟酸(剧毒，演示硬阻断)
        mkStock({ researchGroup: '有机合成课题组', labLocation: '化学楼301', reagentId: bingtong.id, reagentName: '丙酮', casNo: '67-64-1', dangerCategories: ['易制毒'], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 500, sourceBatchNo: 'B2025-PA-01', totalAmount: 500, remainingAmount: 100, opened: false, expiryDate: '2027-06-30', holderClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'] }),
        mkStock({ researchGroup: '有机合成课题组', labLocation: '化学楼301', reagentId: liuSuan.id, reagentName: '硫酸', casNo: '7664-93-9', dangerCategories: ['易制毒', '强腐蚀'], storageCondition: '常温', unit: 'ml', maxSingleAmount: 250, sourceBatchNo: 'B2025-HS-02', totalAmount: 300, remainingAmount: 300, opened: true, openedAt: new Date('2026-08-25T09:00:00'), expiryDate: '2026-12-31', holderClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'] }),
        mkStock({ researchGroup: '有机合成课题组', labLocation: '化学楼301', reagentId: hf.id, reagentName: '氢氟酸', casNo: '7664-39-3', dangerCategories: ['剧毒', '强腐蚀'], storageCondition: '低温避光', unit: 'ml', maxSingleAmount: 100, sourceBatchNo: 'B2025-HF-01', totalAmount: 200, remainingAmount: 200, opened: false, expiryDate: '2026-11-30', holderClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'] }),
        // 分析化学302 暂存：无水乙醇、丙酮
        mkStock({ researchGroup: '分析化学课题组', labLocation: '化学楼302', reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', dangerCategories: [], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 1000, sourceBatchNo: 'B2026-ET-01', totalAmount: 1000, remainingAmount: 800, opened: true, openedAt: new Date('2026-09-01T09:00:00'), expiryDate: '2028-01-01', holderClearance: ['强腐蚀'] }),
        mkStock({ researchGroup: '分析化学课题组', labLocation: '化学楼302', reagentId: bingtong.id, reagentName: '丙酮', casNo: '67-64-1', dangerCategories: ['易制毒'], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 500, sourceBatchNo: 'B2025-PA-02', totalAmount: 300, remainingAmount: 300, opened: false, expiryDate: '2027-06-30', holderClearance: ['强腐蚀'] }),
        // 高分子305 暂存：盐酸、无水乙醇
        mkStock({ researchGroup: '高分子材料课题组', labLocation: '化学楼305', reagentId: yanSuan.id, reagentName: '盐酸', casNo: '7647-01-0', dangerCategories: ['易制毒', '强腐蚀'], storageCondition: '常温', unit: 'ml', maxSingleAmount: 500, sourceBatchNo: 'B2026-HCL-02', totalAmount: 400, remainingAmount: 400, opened: false, expiryDate: '2027-12-31', holderClearance: ['易制毒', '强腐蚀'] }),
        mkStock({ researchGroup: '高分子材料课题组', labLocation: '化学楼305', reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', dangerCategories: [], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 1000, sourceBatchNo: 'B2026-ET-02', totalAmount: 600, remainingAmount: 200, opened: false, expiryDate: '2028-01-01', holderClearance: ['易制毒', '强腐蚀'] }),
      ]);

    let bseq = 0;
    const mkBorrow = (b: Partial<BorrowRequest>) =>
      this.borrows.create({
        borrowNo: `BRW-20260910-${String(++bseq).padStart(4, '0')}`,
        borrowerCollege: '化学学院', lenderCollege: '化学学院',
        borrowerAdvisorClearance: [], borrowerStudentClearance: [], lenderClearance: [],
        dangerCategories: [], riskFactors: [], blocked: false, dualHandover: false,
        ...b,
      } as Partial<BorrowRequest>);
    const bLog = (borrowId: string, node: string, nodeLabel: string, actorId: string, actorName: string, actorRole: string, action: string, comment: string, extra?: any) =>
      this.borrowApprovals.save(this.borrowApprovals.create({ borrowId, node, nodeLabel, actorId, actorName, actorRole, action, comment, extra: extra || null }));

    // ---- BRW1 全流程已闭环：孙七(高分子305) 向 有机合成301 借丙酮 200ml，废液责任拆回高分子，已转运，复盘=实际使用 ----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: sunqi.id, borrowerStudentName: '孙七', borrowerGroup: '高分子材料课题组', borrowerLabLocation: '化学楼305',
        borrowerAdvisorId: zhaoprof.id, borrowerAdvisorName: '赵宏远', borrowerAdvisorClearance: ['易制毒', '强腐蚀'], borrowerStudentClearance: ['易制毒', '强腐蚀'],
        lenderGroup: '有机合成课题组', lenderLabLocation: '化学楼301', lenderAdvisorId: wangprof.id, lenderAdvisorName: '王建国', lenderClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'],
        stockId: gAcetone301.id, reagentId: bingtong.id, reagentName: '丙酮', casNo: '67-64-1', dangerCategories: ['易制毒'], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 500,
        amount: 200, sourceBatchNo: 'B2025-PA-01', opened: false, expiryDate: '2027-06-30',
        projectName: '高分子薄膜溶剂清洗工艺', purpose: '本组丙酮临时断供，同楼层调剂',
        riskLevel: 'HIGH', riskSummary: '危险等级：危险等级 2 级（易制毒）；开封日期：未开封；借用量 200ml（限量 500）；双方导师资质齐备；同楼层 3F',
        transferRoute: '化学楼301 → 三层东侧走廊 → 化学楼305（全程使用防泄漏托盘，不走客梯）', transferContainer: '500ml 防倾覆试剂转运箱（带吸附棉）',
        handoverTime: new Date('2026-09-09T10:00:00'), handoverLocation: '化学楼301门口缓冲区', safetyOfficerId: safety.id, safetyOfficerName: '陈安全',
        handedOverAt: new Date('2026-09-09T10:05:00'), handoverBorrowerName: '孙七', handoverLenderName: '张三', handoverKeeperId: keeper.id, handoverKeeperName: '赵库管', dualHandover: true,
        usedAmount: 180, returnedAmount: 20, wasteType: '有机废液(不含卤)', wasteAmount: 180,
        reviewRiskSource: '实际使用', reviewById: safety.id, reviewByName: '陈安全', reviewedAt: new Date('2026-09-09T16:00:00'),
        reviewConclusion: '借用审批与转移过程规范，风险事件为使用环节通风橱内少量挥发（已在通风橱操作），归因实际使用；废液 180ml 已拆回高分子材料课题组并随转运单处置。',
        status: BorrowStatus.CLOSED,
      }));
      // 实际使用单（归属借入方高分子课题组/项目）
      const reqB = await this.reqs.save(this.reqs.create({
        reqNo: `REQ-B20260909-0001`, sourceType: 'BORROW', borrowId: br.id,
        studentId: sunqi.id, studentName: '孙七', college: '化学学院', researchGroup: '高分子材料课题组',
        projectName: '高分子薄膜溶剂清洗工艺', advisorId: zhaoprof.id, advisorName: '赵宏远',
        reagentId: bingtong.id, reagentName: '丙酮', casNo: '67-64-1', concentration: '跨组借自有机合成课题组（批号 B2025-PA-01）',
        estimatedAmount: 200, unit: 'ml', location: '化学楼305', plannedStart: new Date('2026-09-09T10:30:00'), plannedEnd: new Date('2026-09-09T15:00:00'),
        teamMembers: '张三', dangerCategories: ['易制毒'], requiresDualPickup: true, maxSingleAmount: 500,
        safetyChecklist: { borrowRiskControlled: true }, status: ReqStatus.CLOSED,
      }));
      await this.dispenses.save(this.dispenses.create({
        requisitionId: reqB.id, sourceType: 'GROUP_BORROW', borrowId: br.id, batchId: gAcetone301.id, batchNo: 'B2025-PA-01',
        warehouseName: '组间余流·有机合成课题组（化学楼301）', amount: 200, remainingAfter: 100, unit: 'ml', expiryDate: '2027-06-30',
        opened: false, pickerName: '孙七', secondPickerName: '张三', keeperId: keeper.id, keeperName: '赵库管',
      }));
      await this.usageLogs.save(this.usageLogs.create({
        requisitionId: reqB.id, actualAmount: 180, remainingAmount: 20, unit: 'ml',
        wasteType: '有机废液(不含卤)', wasteAmount: 180, loggedById: sunqi.id, loggedByName: '孙七',
      }));
      // 废液记录：责任拆回实际使用课题组（高分子），来源仅留痕（有机合成）
      const wB = await this.wasteRecords.save(this.wasteRecords.create({
        requisitionId: reqB.id, reqNo: reqB.reqNo, reagentName: '丙酮', projectName: '高分子薄膜溶剂清洗工艺',
        wasteType: '有机废液(不含卤)', amount: 180, unit: 'ml', barrelId: barrelOrg.id, barrelCode: barrelOrg.code,
        containerLabel: '借-废丙酮-高分子-20260909', storedById: keeper.id, storedByName: '赵库管',
        responsibleGroupName: '高分子材料课题组', sourceGroupName: '有机合成课题组', sourceType: 'BORROW', borrowId: br.id,
        status: WasteStatus.TRANSFERRED, manifestId: m1.id,
      }));
      br.usageRequisitionId = reqB.id;
      await this.borrows.save(br);
      await bLog(br.id, 'apply', '提交借用申请', sunqi.id, '孙七', Role.STUDENT, 'submit', '发起跨组借用，实际使用项目：高分子薄膜溶剂清洗工艺', { riskLevel: 'HIGH' });
      await bLog(br.id, BorrowApprover.BORROWER_ADVISOR, '借入方导师', zhaoprof.id, '赵宏远', Role.ADVISOR, 'approve', '实验必要，本组具备易制毒资质');
      await bLog(br.id, BorrowApprover.LENDER_ADVISOR, '借出方导师', wangprof.id, '王建国', Role.ADVISOR, 'approve', '同楼层调剂，同意借出 200ml');
      await bLog(br.id, BorrowApprover.SAFETY, '安全员确认路线与交接', safety.id, '陈安全', Role.SAFETY, 'approve', '易制毒双人交接，路线已确认', { transferRoute: br.transferRoute, handoverTime: br.handoverTime, handoverLocation: br.handoverLocation });
      await bLog(br.id, 'dispense', '库房发放同步（组间余流）', keeper.id, '赵库管', Role.KEEPER, 'dispense', '组间余流发放 200ml，台账已同步', { requisitionId: reqB.id });
      await bLog(br.id, 'handover', '现场交接', keeper.id, '赵库管', Role.KEEPER, 'handover', '张三 → 孙七 双人现场交接');
      await bLog(br.id, 'usage', '实际使用登记', sunqi.id, '孙七', Role.STUDENT, 'usage', '使用 180ml，归还 20ml，废液 180ml 责任拆回高分子材料课题组');
      await bLog(br.id, 'review', '安全员复盘', safety.id, '陈安全', Role.SAFETY, 'review', '风险来自实际使用，已闭环', { reviewRiskSource: '实际使用' });
    }

    // ---- BRW2 待安全员确认路线：孙七(305) 向 有机合成301 借已开封硫酸 100ml（高风险：易制毒+已开封）----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: sunqi.id, borrowerStudentName: '孙七', borrowerGroup: '高分子材料课题组', borrowerLabLocation: '化学楼305',
        borrowerAdvisorId: zhaoprof.id, borrowerAdvisorName: '赵宏远', borrowerAdvisorClearance: ['易制毒', '强腐蚀'], borrowerStudentClearance: ['易制毒', '强腐蚀'],
        lenderGroup: '有机合成课题组', lenderLabLocation: '化学楼301', lenderAdvisorId: wangprof.id, lenderAdvisorName: '王建国', lenderClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'],
        stockId: gSulfuric301.id, reagentId: liuSuan.id, reagentName: '硫酸', casNo: '7664-93-9', dangerCategories: ['易制毒', '强腐蚀'], storageCondition: '常温', unit: 'ml', maxSingleAmount: 250,
        amount: 100, sourceBatchNo: 'B2025-HS-02', opened: true, openedAt: new Date('2026-08-25T09:00:00'), expiryDate: '2026-12-31',
        projectName: '高分子酸催化交联实验', purpose: '少量浓硫酸催化，本组断供',
        riskLevel: 'HIGH', riskSummary: '危险等级 2 级（易制毒、强腐蚀）；批次已开封 16 天（30 天安全期内，风险上调）；借用量 100ml（限量 250）；双方资质齐备；同楼层 3F',
        status: BorrowStatus.PENDING_SAFETY,
      }));
      await bLog(br.id, 'apply', '提交借用申请', sunqi.id, '孙七', Role.STUDENT, 'submit', '发起跨组借用：高分子酸催化交联实验', { riskLevel: 'HIGH' });
      await bLog(br.id, BorrowApprover.BORROWER_ADVISOR, '借入方导师', zhaoprof.id, '赵宏远', Role.ADVISOR, 'approve', '催化实验必需，已开封试剂注意核验外观');
      await bLog(br.id, BorrowApprover.LENDER_ADVISOR, '借出方导师', wangprof.id, '王建国', Role.ADVISOR, 'approve', '同意借 100ml，要求全程通风橱转移');
    }

    // ---- BRW3 待借出方导师同意：张三(301) 向 分析化学302 借无水乙醇 300ml（低风险）----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: zhangsan.id, borrowerStudentName: '张三', borrowerGroup: '有机合成课题组', borrowerLabLocation: '化学楼301',
        borrowerAdvisorId: wangprof.id, borrowerAdvisorName: '王建国', borrowerAdvisorClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'], borrowerStudentClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'],
        lenderGroup: '分析化学课题组', lenderLabLocation: '化学楼302', lenderAdvisorId: liuprof.id, lenderAdvisorName: '刘敏', lenderClearance: ['强腐蚀'],
        stockId: gEthanol302.id, reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', dangerCategories: [], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 1000,
        amount: 300, sourceBatchNo: 'B2026-ET-01', opened: true, openedAt: new Date('2026-09-01T09:00:00'), expiryDate: '2028-01-01',
        projectName: '天然产物提取溶剂补缺', purpose: '提取溶剂临时不足',
        riskLevel: 'LOW', riskSummary: '普通试剂（0 级）；已开封 9 天；借用量 300ml（限量 1000）；同楼层 3F',
        status: BorrowStatus.PENDING_LENDER_ADVISOR,
      }));
      await bLog(br.id, 'apply', '提交借用申请', zhangsan.id, '张三', Role.STUDENT, 'submit', '发起跨组借用：天然产物提取溶剂补缺', { riskLevel: 'LOW' });
      await bLog(br.id, BorrowApprover.BORROWER_ADVISOR, '借入方导师', wangprof.id, '王建国', Role.ADVISOR, 'approve', '普通试剂，同意调剂');
    }

    // ---- BRW4 待借入方导师确认：张三(301) 向 高分子305 借盐酸 150ml ----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: zhangsan.id, borrowerStudentName: '张三', borrowerGroup: '有机合成课题组', borrowerLabLocation: '化学楼301',
        borrowerAdvisorId: wangprof.id, borrowerAdvisorName: '王建国', borrowerAdvisorClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'], borrowerStudentClearance: ['剧毒', '易制毒', '易制爆', '强腐蚀', '低温保存'],
        lenderGroup: '高分子材料课题组', lenderLabLocation: '化学楼305', lenderAdvisorId: zhaoprof.id, lenderAdvisorName: '赵宏远', lenderClearance: ['易制毒', '强腐蚀'],
        stockId: gHCl305.id, reagentId: yanSuan.id, reagentName: '盐酸', casNo: '7647-01-0', dangerCategories: ['易制毒', '强腐蚀'], storageCondition: '常温', unit: 'ml', maxSingleAmount: 500,
        amount: 150, sourceBatchNo: 'B2026-HCL-02', opened: false, expiryDate: '2027-12-31',
        projectName: '样品前处理酸解实验', purpose: '盐酸临时缺料',
        riskLevel: 'HIGH', riskSummary: '危险等级 2 级（易制毒、强腐蚀）；未开封；借用量 150ml（限量 500）；双方资质齐备；同楼层 3F',
        status: BorrowStatus.PENDING_BORROWER_ADVISOR,
      }));
      await bLog(br.id, 'apply', '提交借用申请', zhangsan.id, '张三', Role.STUDENT, 'submit', '发起跨组借用：样品前处理酸解实验', { riskLevel: 'HIGH' });
    }

    // ---- BRW5 安全员已批路线、待库管「组间余流发放」：孙七(305) 向 分析化学302 借无水乙醇 100ml（低风险）----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: sunqi.id, borrowerStudentName: '孙七', borrowerGroup: '高分子材料课题组', borrowerLabLocation: '化学楼305',
        borrowerAdvisorId: zhaoprof.id, borrowerAdvisorName: '赵宏远', borrowerAdvisorClearance: ['易制毒', '强腐蚀'], borrowerStudentClearance: ['易制毒', '强腐蚀'],
        lenderGroup: '分析化学课题组', lenderLabLocation: '化学楼302', lenderAdvisorId: liuprof.id, lenderAdvisorName: '刘敏', lenderClearance: ['强腐蚀'],
        stockId: gEthanol302.id, reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', dangerCategories: [], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 1000,
        amount: 100, sourceBatchNo: 'B2026-ET-01', opened: true, openedAt: new Date('2026-09-01T09:00:00'), expiryDate: '2028-01-01',
        projectName: '高分子基片清洁', purpose: '少量乙醇擦拭',
        riskLevel: 'LOW', riskSummary: '普通试剂（0 级）；已开封 9 天；借用量 100ml（限量 1000）；同楼层 3F',
        transferRoute: '化学楼302 → 三层连廊 → 化学楼305', transferContainer: '250ml 防泄漏转运瓶',
        handoverTime: new Date('2026-09-11T09:30:00'), handoverLocation: '化学楼302门口', safetyOfficerId: safety.id, safetyOfficerName: '陈安全',
        status: BorrowStatus.DISPENSE_READY,
      }));
      await bLog(br.id, 'apply', '提交借用申请', sunqi.id, '孙七', Role.STUDENT, 'submit', '发起跨组借用：高分子基片清洁', { riskLevel: 'LOW' });
      await bLog(br.id, BorrowApprover.BORROWER_ADVISOR, '借入方导师', zhaoprof.id, '赵宏远', Role.ADVISOR, 'approve', '同意');
      await bLog(br.id, BorrowApprover.LENDER_ADVISOR, '借出方导师', liuprof.id, '刘敏', Role.ADVISOR, 'approve', '同意调剂');
      await bLog(br.id, BorrowApprover.SAFETY, '安全员确认路线与交接', safety.id, '陈安全', Role.SAFETY, 'approve', '普通试剂，路线短、同楼层', { transferRoute: br.transferRoute, handoverTime: br.handoverTime, handoverLocation: br.handoverLocation });
    }

    // ---- BRW6 已交接、使用中，交接发现瓶盖渗漏（转移过程风险事件，待安全员处理）：李四(302) 向 高分子305 借乙醇 200ml ----
    {
      const br = await this.borrows.save(mkBorrow({
        borrowerStudentId: lisi.id, borrowerStudentName: '李四', borrowerGroup: '分析化学课题组', borrowerLabLocation: '化学楼302',
        borrowerAdvisorId: liuprof.id, borrowerAdvisorName: '刘敏', borrowerAdvisorClearance: ['强腐蚀'], borrowerStudentClearance: ['强腐蚀'],
        lenderGroup: '高分子材料课题组', lenderLabLocation: '化学楼305', lenderAdvisorId: zhaoprof.id, lenderAdvisorName: '赵宏远', lenderClearance: ['易制毒', '强腐蚀'],
        stockId: gEthanol305.id, reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', dangerCategories: [], storageCondition: '常温避光', unit: 'ml', maxSingleAmount: 1000,
        amount: 200, sourceBatchNo: 'B2026-ET-02', opened: false, expiryDate: '2028-01-01',
        projectName: '色谱柱冲洗', purpose: '流动相调剂',
        riskLevel: 'LOW', riskSummary: '普通试剂（0 级）；未开封；借用量 200ml；同楼层 3F',
        transferRoute: '化学楼305 → 三层连廊 → 化学楼302', transferContainer: '500ml 转运瓶',
        handoverTime: new Date('2026-09-10T08:30:00'), handoverLocation: '化学楼305门口', safetyOfficerId: safety.id, safetyOfficerName: '陈安全',
        handedOverAt: new Date('2026-09-10T08:35:00'), handoverBorrowerName: '李四', handoverLenderName: '孙七', handoverKeeperId: keeper.id, handoverKeeperName: '赵库管', dualHandover: false,
        status: BorrowStatus.IN_USE,
      }));
      const reqB = await this.reqs.save(this.reqs.create({
        reqNo: `REQ-B20260910-0002`, sourceType: 'BORROW', borrowId: br.id,
        studentId: lisi.id, studentName: '李四', college: '化学学院', researchGroup: '分析化学课题组',
        projectName: '色谱柱冲洗', advisorId: liuprof.id, advisorName: '刘敏',
        reagentId: ethanol.id, reagentName: '无水乙醇', casNo: '64-17-5', concentration: '跨组借自高分子材料课题组（批号 B2026-ET-02）',
        estimatedAmount: 200, unit: 'ml', location: '化学楼302', plannedStart: new Date('2026-09-10T09:00:00'), plannedEnd: new Date('2026-09-10T12:00:00'),
        dangerCategories: [], requiresDualPickup: false, maxSingleAmount: 1000, safetyChecklist: { borrowRiskControlled: true }, status: ReqStatus.IN_USE,
      }));
      await this.dispenses.save(this.dispenses.create({
        requisitionId: reqB.id, sourceType: 'GROUP_BORROW', borrowId: br.id, batchId: gEthanol305.id, batchNo: 'B2026-ET-02',
        warehouseName: '组间余流·高分子材料课题组（化学楼305）', amount: 200, remainingAfter: 200, unit: 'ml', expiryDate: '2028-01-01',
        opened: false, pickerName: '李四', keeperId: keeper.id, keeperName: '赵库管',
      }));
      br.usageRequisitionId = reqB.id;
      await this.borrows.save(br);
      await bLog(br.id, 'apply', '提交借用申请', lisi.id, '李四', Role.STUDENT, 'submit', '色谱柱冲洗', { riskLevel: 'LOW' });
      await bLog(br.id, BorrowApprover.BORROWER_ADVISOR, '借入方导师', liuprof.id, '刘敏', Role.ADVISOR, 'approve', '同意');
      await bLog(br.id, BorrowApprover.LENDER_ADVISOR, '借出方导师', zhaoprof.id, '赵宏远', Role.ADVISOR, 'approve', '同意');
      await bLog(br.id, BorrowApprover.SAFETY, '安全员确认路线与交接', safety.id, '陈安全', Role.SAFETY, 'approve', '普通试剂，短距离转移', { transferRoute: br.transferRoute, handoverTime: br.handoverTime, handoverLocation: br.handoverLocation });
      await bLog(br.id, 'dispense', '库房发放同步（组间余流）', keeper.id, '赵库管', Role.KEEPER, 'dispense', '组间余流发放 200ml', { requisitionId: reqB.id });
      await bLog(br.id, 'handover', '现场交接', keeper.id, '赵库管', Role.KEEPER, 'handover', '孙七 → 李四 现场交接，发现瓶盖密封处有渗漏痕迹', { handoverBorrowerName: '李四', handoverLenderName: '孙七', issue: '转运瓶瓶盖密封圈老化，交接时发现瓶口有微量渗漏（已用吸附棉处理）' });
      // 转移过程风险事件（OPEN，待安全员处理，复盘可归因「转移过程」）
      await this.anomalies.save(this.anomalies.create({
        type: AnomalyType.BORROW_TRANSFER_RISK, borrowId: br.id, requisitionId: reqB.id, reqNo: br.borrowNo, riskSource: '转移过程', status: 'OPEN',
        description: `${br.borrowNo} 现场交接发现问题：转运瓶瓶盖密封圈老化，瓶口微量渗漏（路线：${br.transferRoute}，交接地点：${br.handoverLocation}），已用吸附棉应急处理`,
      }));
    }
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, TrainingRecord, ReagentCatalog, Warehouse, InventoryBatch, FumeHood,
      WasteBarrel, Requisition, Approval, DispenseRecord, UsageLog, WasteRecord,
      TransferManifest, Anomaly, GroupReagentStock, BorrowRequest, BorrowApproval,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
