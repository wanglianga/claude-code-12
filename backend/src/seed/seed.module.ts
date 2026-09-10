import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  Anomaly,
  Approval,
  DispenseRecord,
  FumeHood,
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
import { AnomalyType, ManifestStatus, ReqStatus, Role, WasteStatus } from '../common/enums';

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

    // ---------- 用户（测试账号见 README） ----------
    const [admin, zhangsan, lisi, wangwu, wangprof, liuprof, safety, keeper, college] =
      await this.users.save([
        this.users.create({ username: 'admin', passwordHash: hash('Admin@12345'), name: '系统管理员', role: Role.ADMIN, college: '实验室与设备管理处' }),
        this.users.create({ username: 'zhangsan', passwordHash: hash('Student@123'), name: '张三', role: Role.STUDENT, college: '化学学院', researchGroup: '有机合成课题组' }),
        this.users.create({ username: 'lisi', passwordHash: hash('Student@123'), name: '李四', role: Role.STUDENT, college: '化学学院', researchGroup: '分析化学课题组' }),
        this.users.create({ username: 'wangwu', passwordHash: hash('Student@123'), name: '王五', role: Role.STUDENT, college: '材料学院', researchGroup: '功能材料课题组' }),
        this.users.create({ username: 'wangprof', passwordHash: hash('Advisor@123'), name: '王建国', role: Role.ADVISOR, college: '化学学院', researchGroup: '有机合成课题组' }),
        this.users.create({ username: 'liuprof', passwordHash: hash('Advisor@123'), name: '刘敏', role: Role.ADVISOR, college: '化学学院', researchGroup: '分析化学课题组' }),
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
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, TrainingRecord, ReagentCatalog, Warehouse, InventoryBatch, FumeHood,
      WasteBarrel, Requisition, Approval, DispenseRecord, UsageLog, WasteRecord,
      TransferManifest, Anomaly,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
