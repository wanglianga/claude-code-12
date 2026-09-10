import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
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
  WasteRecord,
} from '../common/entities';
import { CurrentUser, Roles } from '../common/auth';
import { AnomalyType, ReqStatus, Role, needDualPickup, todayStr } from '../common/enums';

class CreateRequisitionDto {
  @IsString() @IsNotEmpty() projectName: string;
  @IsString() @IsNotEmpty() advisorId: string;
  @IsString() @IsNotEmpty() reagentId: string;
  @IsString() @IsNotEmpty() concentration: string;
  @IsNumber() @Min(0.01) estimatedAmount: number;
  @IsString() @IsNotEmpty() location: string;
  @IsString() @IsNotEmpty() plannedStart: string;
  @IsString() @IsNotEmpty() plannedEnd: string;
  @IsOptional() @IsString() teamMembers?: string;
  @IsOptional() @IsString() remark?: string;
}

class AdvisorDecisionDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() comment?: string;
}

class SafetyDecisionDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsObject() checklist?: Record<string, boolean>;
  @IsOptional() @IsString() fumeHoodId?: string;
  @IsOptional() @IsNumber() @Min(0.01) maxSingleAmount?: number;
  @IsOptional() @IsBoolean() requiresDualPickup?: boolean;
}

class DispenseDto {
  @IsString() @IsNotEmpty() batchId: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsBoolean() opened: boolean;
  @IsString() @IsNotEmpty() pickerName: string;
  @IsOptional() @IsString() secondPickerName?: string;
}

class UsageDto {
  @IsNumber() @Min(0) actualAmount: number;
  @IsNumber() @Min(0) remainingAmount: number;
  @IsOptional() @IsString() spillDesc?: string;
  @IsOptional() @IsString() wasteType?: string;
  @IsOptional() @IsNumber() @Min(0) wasteAmount?: number;
  @IsOptional() @IsBoolean() fumeHoodFault?: boolean;
}

@Controller('requisitions')
export class RequisitionsController {
  constructor(
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
    @InjectRepository(Approval) private approvals: Repository<Approval>,
    @InjectRepository(DispenseRecord) private dispenses: Repository<DispenseRecord>,
    @InjectRepository(UsageLog) private usageLogs: Repository<UsageLog>,
    @InjectRepository(WasteRecord) private wasteRecords: Repository<WasteRecord>,
    @InjectRepository(TransferManifest) private manifests: Repository<TransferManifest>,
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    @InjectRepository(ReagentCatalog) private catalog: Repository<ReagentCatalog>,
    @InjectRepository(InventoryBatch) private batches: Repository<InventoryBatch>,
    @InjectRepository(TrainingRecord) private trainings: Repository<TrainingRecord>,
    @InjectRepository(FumeHood) private hoods: Repository<FumeHood>,
    @InjectRepository(User) private users: Repository<User>,
    private dataSource: DataSource,
  ) {}

  // ---------- 学生提交申请：自动判定危险类别 ----------
  @Post()
  @Roles(Role.STUDENT)
  async create(@Body() dto: CreateRequisitionDto, @CurrentUser() me: any) {
    const reagent = await this.catalog.findOne({ where: { id: dto.reagentId } });
    if (!reagent) throw new BadRequestException('试剂不在目录中，请联系管理员维护');
    const advisor = await this.users.findOne({ where: { id: dto.advisorId, role: Role.ADVISOR } });
    if (!advisor) throw new BadRequestException('导师不存在');

    const dangers = reagent.dangerCategories || [];
    const count = await this.reqs.count();
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const req = this.reqs.create({
      reqNo: `REQ-${ymd}-${String(count + 1).padStart(4, '0')}`,
      studentId: me.sub,
      studentName: me.name,
      college: me.college,
      researchGroup: me.researchGroup,
      projectName: dto.projectName,
      advisorId: advisor.id,
      advisorName: advisor.name,
      reagentId: reagent.id,
      reagentName: reagent.name,
      casNo: reagent.casNo,
      concentration: dto.concentration,
      estimatedAmount: dto.estimatedAmount,
      unit: reagent.unit,
      location: dto.location,
      plannedStart: new Date(dto.plannedStart),
      plannedEnd: new Date(dto.plannedEnd),
      teamMembers: dto.teamMembers || null,
      dangerCategories: dangers,
      requiresDualPickup: needDualPickup(dangers),
      maxSingleAmount: reagent.maxSingleAmount ?? null,
      status: ReqStatus.PENDING_ADVISOR,
      remark: dto.remark || null,
    });
    return this.reqs.save(req);
  }

  // ---------- 列表（按角色过滤） ----------
  @Get()
  async list(@CurrentUser() me: any, @Query('status') status?: string, @Query('source') source?: string) {
    const where: any = {};
    if (me.role === Role.STUDENT) where.studentId = me.sub;
    if (me.role === Role.ADVISOR) where.advisorId = me.sub;
    if (status) where.status = status;
    if (source === 'NORMAL') where.sourceType = 'NORMAL'; // 借用台账单独在「试剂借用」菜单查看
    const list = await this.reqs.find({ where, order: { createdAt: 'DESC' } });
    if (!source && me.role === Role.STUDENT) {
      // 学生默认列表不混入跨组借用自动生成的使用单（其使用/废液入口在借用详情）
      return list.filter((r) => r.sourceType !== 'BORROW');
    }
    return list;
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    this.assertVisible(req, me);
    return req;
  }

  // ---------- 安全员审批预检：培训记录 / 库存 / 通风橱 / 同组人员 ----------
  @Get(':id/precheck')
  @Roles(Role.SAFETY, Role.ADMIN)
  async precheck(@Param('id') id: string) {
    const req = await this.getReq(id);
    const today = todayStr();
    const records = await this.trainings.find({ where: { userId: req.studentId } });
    const validRecords = records.filter((r) => r.validUntil >= today);
    const batches = await this.batches.find({ where: { reagentId: req.reagentId, status: '在库' } });
    const validBatches = batches.filter((b) => b.expiryDate >= today && b.remainingAmount > 0);
    const available = validBatches.reduce((s, b) => s + b.remainingAmount, 0);
    const hoods = await this.hoods.find({ order: { code: 'ASC' } });
    return {
      training: { ok: validRecords.length > 0, records, validRecords },
      inventory: { ok: available >= req.estimatedAmount, available, required: req.estimatedAmount, batches: validBatches },
      fumeHoods: hoods,
      teamMembers: req.teamMembers,
    };
  }

  // ---------- 导师审批：确认实验必要性 ----------
  @Post(':id/advisor-decision')
  @Roles(Role.ADVISOR, Role.ADMIN)
  async advisorDecision(@Param('id') id: string, @Body() dto: AdvisorDecisionDto, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    if (req.status !== ReqStatus.PENDING_ADVISOR) throw new BadRequestException('当前状态不可导师审批');
    if (req.sourceType === 'BORROW') throw new BadRequestException('跨组借用单请在「试剂借用」中完成双方导师审批');
    if (me.role === Role.ADVISOR && req.advisorId !== me.sub) throw new ForbiddenException('仅该申请的导师可审批');
    await this.approvals.save(
      this.approvals.create({
        requisitionId: req.id,
        approverId: me.sub,
        approverName: me.name,
        role: 'advisor',
        action: dto.approve ? 'approve' : 'reject',
        comment: dto.comment || null,
      }),
    );
    req.status = dto.approve ? ReqStatus.PENDING_SAFETY : ReqStatus.REJECTED;
    if (!dto.approve) req.rejectReason = dto.comment || '导师驳回';
    return this.reqs.save(req);
  }

  // ---------- 安全员审批：核查培训/防护/通风橱/同组/库存 ----------
  @Post(':id/safety-decision')
  @Roles(Role.SAFETY, Role.ADMIN)
  async safetyDecision(@Param('id') id: string, @Body() dto: SafetyDecisionDto, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    if (req.status !== ReqStatus.PENDING_SAFETY) throw new BadRequestException('当前状态不可安全员审批');
    if (req.sourceType === 'BORROW') throw new BadRequestException('跨组借用单的路线审批请在「试剂借用」中完成');

    if (dto.approve) {
      const ck = dto.checklist || {};
      const missing = ['trainingOk', 'ppeOk', 'fumeHoodOk', 'teamOk', 'inventoryOk'].filter((k) => !ck[k]);
      if (missing.length) throw new BadRequestException('核查项未全部通过：' + missing.join(','));
      // 服务端复核：培训记录有效
      const today = todayStr();
      const valid = await this.trainings.find({ where: { userId: req.studentId } });
      if (!valid.some((r) => r.validUntil >= today)) throw new BadRequestException('该学生无有效培训记录，不能通过');
      // 服务端复核：有效库存充足
      const batches = await this.batches.find({ where: { reagentId: req.reagentId, status: '在库' } });
      const available = batches.filter((b) => b.expiryDate >= today).reduce((s, b) => s + b.remainingAmount, 0);
      if (available < req.estimatedAmount) throw new BadRequestException(`有效库存不足（${available}${req.unit}），不能通过`);
      // 通风橱
      if (dto.fumeHoodId) {
        const hood = await this.hoods.findOne({ where: { id: dto.fumeHoodId } });
        if (!hood) throw new BadRequestException('通风橱不存在');
        if (hood.status !== '正常') throw new BadRequestException(`通风橱 ${hood.code} 当前故障，不能预约`);
        req.fumeHoodId = hood.id;
        req.fumeHoodCode = hood.code;
      }
      req.safetyChecklist = ck;
      if (dto.maxSingleAmount) req.maxSingleAmount = dto.maxSingleAmount;
      if (dto.requiresDualPickup !== undefined) req.requiresDualPickup = dto.requiresDualPickup;
    }

    await this.approvals.save(
      this.approvals.create({
        requisitionId: req.id,
        approverId: me.sub,
        approverName: me.name,
        role: 'safety_officer',
        action: dto.approve ? 'approve' : 'reject',
        comment: dto.comment || null,
        checks: dto.checklist || null,
      }),
    );
    req.status = dto.approve ? ReqStatus.APPROVED : ReqStatus.REJECTED;
    if (!dto.approve) req.rejectReason = dto.comment || '安全员驳回';
    return this.reqs.save(req);
  }

  // ---------- 库管出库：批号/余量/有效期/开封/领取人 ----------
  @Post(':id/dispense')
  @Roles(Role.KEEPER, Role.ADMIN)
  async dispense(@Param('id') id: string, @Body() dto: DispenseDto, @CurrentUser() me: any) {
    return this.dataSource.transaction(async (em) => {
      const req = await em.getRepository(Requisition).findOne({ where: { id } });
      if (!req) throw new NotFoundException('申请不存在');
      if (req.status !== ReqStatus.APPROVED) throw new BadRequestException('当前状态不可出库');
      if (req.sourceType === 'BORROW') throw new BadRequestException('跨组借用的发放请使用「试剂借用」的组间余流发放');
      if (req.requiresDualPickup && !dto.secondPickerName?.trim()) {
        throw new BadRequestException('该试剂属于易制毒/易制爆/剧毒类，必须双人领取');
      }
      const batch = await em.getRepository(InventoryBatch).findOne({
        where: { id: dto.batchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch || batch.reagentId !== req.reagentId) throw new BadRequestException('批次与申请试剂不符');
      if (batch.status !== '在库') throw new BadRequestException(`批次状态为「${batch.status}」，不可出库`);
      if (batch.expiryDate < todayStr()) throw new BadRequestException(`批次 ${batch.batchNo} 已过有效期，禁止发放`);
      const limit = req.maxSingleAmount ?? Infinity;
      if (dto.amount > limit) throw new BadRequestException(`超过单次领用限量 ${limit}${req.unit}`);
      if (dto.amount > batch.remainingAmount) throw new BadRequestException(`批次余量不足（剩余 ${batch.remainingAmount}${batch.unit}）`);

      batch.remainingAmount = +(batch.remainingAmount - dto.amount).toFixed(4);
      if (dto.opened && !batch.opened) {
        batch.opened = true;
        batch.openedAt = new Date();
      }
      if (batch.remainingAmount <= 0) batch.status = '用尽';
      await em.getRepository(InventoryBatch).save(batch);

      const record = em.getRepository(DispenseRecord).create({
        requisitionId: req.id,
        batchId: batch.id,
        batchNo: batch.batchNo,
        warehouseName: batch.warehouseName,
        amount: dto.amount,
        remainingAfter: batch.remainingAmount,
        unit: req.unit,
        expiryDate: batch.expiryDate,
        opened: dto.opened,
        pickerName: dto.pickerName,
        secondPickerName: dto.secondPickerName || null,
        keeperId: me.sub,
        keeperName: me.name,
      });
      await em.getRepository(DispenseRecord).save(record);
      req.status = ReqStatus.IN_USE;
      await em.getRepository(Requisition).save(req);
      return record;
    });
  }

  // ---------- 学生使用登记：实际用量/剩余/洒漏/废液，触发异常 ----------
  @Post(':id/usage')
  @Roles(Role.STUDENT)
  async logUsage(@Param('id') id: string, @Body() dto: UsageDto, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    if (req.studentId !== me.sub) throw new ForbiddenException('仅申请人本人可登记');
    if (req.sourceType === 'BORROW') throw new BadRequestException('跨组借用试剂请在「试剂借用」详情中登记实际使用');
    if (![ReqStatus.IN_USE, ReqStatus.USAGE_LOGGED].includes(req.status as ReqStatus)) {
      throw new BadRequestException('当前状态不可登记使用');
    }
    const log = await this.usageLogs.save(
      this.usageLogs.create({
        requisitionId: req.id,
        actualAmount: dto.actualAmount,
        remainingAmount: dto.remainingAmount,
        unit: req.unit,
        spillDesc: dto.spillDesc || null,
        wasteType: dto.wasteType || null,
        wasteAmount: dto.wasteAmount ?? null,
        fumeHoodFault: !!dto.fumeHoodFault,
        loggedById: me.sub,
        loggedByName: me.name,
      }),
    );

    // 异常触发：用量超申请
    if (dto.actualAmount > req.estimatedAmount) {
      await this.createAnomaly({
        type: AnomalyType.OVER_USAGE,
        requisitionId: req.id,
        reqNo: req.reqNo,
        usageLogId: log.id,
        description: `实际用量 ${dto.actualAmount}${req.unit} 超过申请量 ${req.estimatedAmount}${req.unit}（${req.reagentName}）`,
      });
    }
    // 异常触发：通风橱故障
    if (dto.fumeHoodFault) {
      if (req.fumeHoodId) {
        await this.hoods.update({ id: req.fumeHoodId }, { status: '故障' });
      }
      await this.createAnomaly({
        type: AnomalyType.FUME_HOOD_FAULT,
        requisitionId: req.id,
        reqNo: req.reqNo,
        usageLogId: log.id,
        description: `实验过程中报告通风橱${req.fumeHoodCode ? ` ${req.fumeHoodCode} ` : ''}故障`,
      });
    }
    // 异常触发：异常洒漏
    if (dto.spillDesc?.trim()) {
      await this.createAnomaly({
        type: AnomalyType.SPILL,
        requisitionId: req.id,
        reqNo: req.reqNo,
        usageLogId: log.id,
        description: `异常洒漏：${dto.spillDesc}`,
      });
    }
    // 异常触发：出库批次已过期
    const dispense = await this.dispenses.findOne({ where: { requisitionId: req.id } });
    if (dispense && dispense.expiryDate < todayStr()) {
      await this.createAnomaly({
        type: AnomalyType.REAGENT_EXPIRED,
        requisitionId: req.id,
        reqNo: req.reqNo,
        usageLogId: log.id,
        description: `出库批次 ${dispense.batchNo} 有效期至 ${dispense.expiryDate}，使用时已过期`,
      });
    }

    req.status = ReqStatus.USAGE_LOGGED;
    await this.reqs.save(req);
    return log;
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    if (req.studentId !== me.sub && me.role !== Role.ADMIN) throw new ForbiddenException('仅申请人可取消');
    if (![ReqStatus.PENDING_ADVISOR, ReqStatus.PENDING_SAFETY].includes(req.status as ReqStatus)) {
      throw new BadRequestException('当前状态不可取消');
    }
    req.status = ReqStatus.CANCELLED;
    return this.reqs.save(req);
  }

  // ---------- 全链路视图：申请→审批→出库→使用→废液→转运 是否闭合 ----------
  @Get(':id/chain')
  async chain(@Param('id') id: string, @CurrentUser() me: any) {
    const req = await this.getReq(id);
    this.assertVisible(req, me);
    const [approvals, dispense, usageLogs, wasteRecords, anomalies] = await Promise.all([
      this.approvals.find({ where: { requisitionId: id }, order: { createdAt: 'ASC' } }),
      this.dispenses.findOne({ where: { requisitionId: id } }),
      this.usageLogs.find({ where: { requisitionId: id }, order: { createdAt: 'ASC' } }),
      this.wasteRecords.find({ where: { requisitionId: id }, order: { createdAt: 'ASC' } }),
      this.anomalies.find({ where: { requisitionId: id }, order: { createdAt: 'ASC' } }),
    ]);
    const manifestIds = wasteRecords.map((w) => w.manifestId).filter(Boolean);
    const manifests = manifestIds.length ? await this.manifests.findBy({ id: In(manifestIds) }) : [];
    const manifestMap = Object.fromEntries(manifests.map((m) => [m.id, m]));

    const advisorApproval = approvals.find((a) => a.role === 'advisor');
    const safetyApproval = approvals.find((a) => a.role === 'safety_officer');
    const transferred = wasteRecords.length > 0 && wasteRecords.every((w) => w.status === 'TRANSFERRED');

    const stages = [
      { key: 'apply', label: '提交申请', done: true, time: req.createdAt },
      {
        key: 'advisor',
        label: '导师审批',
        done: advisorApproval?.action === 'approve',
        rejected: advisorApproval?.action === 'reject',
        time: advisorApproval?.createdAt,
      },
      {
        key: 'safety',
        label: '安全员审批',
        done: safetyApproval?.action === 'approve',
        rejected: safetyApproval?.action === 'reject',
        time: safetyApproval?.createdAt,
      },
      { key: 'dispense', label: '试剂出库', done: !!dispense, time: dispense?.dispensedAt },
      { key: 'usage', label: '使用登记', done: usageLogs.length > 0, time: usageLogs[0]?.createdAt },
      { key: 'waste', label: '废液入库', done: wasteRecords.length > 0, time: wasteRecords[0]?.createdAt },
      { key: 'transfer', label: '转运处置', done: transferred, time: null },
    ];
    return {
      requisition: req,
      approvals,
      dispense,
      usageLogs,
      wasteRecords: wasteRecords.map((w) => ({ ...w, manifest: w.manifestId ? manifestMap[w.manifestId] || null : null })),
      anomalies,
      stages,
      closed: transferred,
    };
  }

  // ---------- helpers ----------
  private async getReq(id: string) {
    const req = await this.reqs.findOne({ where: { id } });
    if (!req) throw new NotFoundException('申请单不存在');
    return req;
  }

  private assertVisible(req: Requisition, me: any) {
    if ([Role.ADMIN, Role.SAFETY, Role.KEEPER, Role.COLLEGE].includes(me.role as Role)) return;
    if (me.role === Role.STUDENT && req.studentId === me.sub) return;
    if (me.role === Role.ADVISOR && req.advisorId === me.sub) return;
    throw new ForbiddenException('无权查看该申请');
  }

  private async createAnomaly(data: Partial<Anomaly>) {
    // 同一申请/同一类型存在未处理异常时不重复创建
    const dup = await this.anomalies.findOne({
      where: { type: data.type, requisitionId: data.requisitionId, status: 'OPEN' },
    });
    if (dup) return dup;
    return this.anomalies.save(this.anomalies.create(data));
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Requisition,
      Approval,
      DispenseRecord,
      UsageLog,
      WasteRecord,
      TransferManifest,
      Anomaly,
      ReagentCatalog,
      InventoryBatch,
      TrainingRecord,
      FumeHood,
      User,
    ]),
  ],
  controllers: [RequisitionsController],
})
export class RequisitionsModule {}
