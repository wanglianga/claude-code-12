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
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  Anomaly,
  BorrowApproval,
  BorrowRequest,
  DispenseRecord,
  GroupReagentStock,
  ReagentCatalog,
  Requisition,
  UsageLog,
  User,
  WasteRecord,
} from '../common/entities';
import { CurrentUser, Roles } from '../common/auth';
import {
  AnomalyType,
  BorrowApprover,
  BorrowRiskLevel,
  BorrowStatus,
  ReqStatus,
  Role,
  assessBorrowRisk,
  dangerRankOf,
  floorOf,
  needDualPickup,
  sameFloor,
  todayStr,
} from '../common/enums';

class CreateBorrowDto {
  @IsString() @IsNotEmpty() stockId: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() projectName: string; // 实际使用项目（废液责任锚点）
  @IsOptional() @IsString() purpose?: string;
}

class RiskPreviewDto {
  @IsString() @IsNotEmpty() stockId: string;
  @IsNumber() @Min(0.01) amount: number;
}

class DecisionDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() comment?: string;
}

class SafetyDecisionDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() transferRoute?: string; // 转移路线
  @IsOptional() @IsString() transferContainer?: string; // 防泄漏转运容器
  @IsOptional() @IsString() handoverTime?: string; // 交接时间
  @IsOptional() @IsString() handoverLocation?: string; // 交接地点
}

class DispenseBorrowDto {
  @IsOptional() @IsString() secondPickerName?: string; // 危险试剂双人交接第二人
}

class HandoverDto {
  @IsString() @IsNotEmpty() handoverBorrowerName: string; // 借入方接收人
  @IsString() @IsNotEmpty() handoverLenderName: string; // 借出方交出人
  @IsOptional() @IsString() issue?: string; // 交接时发现的问题（触发转移过程风险事件）
}

class UsageBorrowDto {
  @IsNumber() @Min(0) usedAmount: number; // 实际使用量
  @IsNumber() @Min(0) returnedAmount: number; // 余量归还
  @IsOptional() @IsString() wasteType?: string;
  @IsOptional() @IsNumber() @Min(0) wasteAmount?: number;
  @IsOptional() @IsString() spillDesc?: string; // 异常洒漏
}

class ReviewBorrowDto {
  @IsString() @IsNotEmpty() reviewRiskSource: string; // 借用本身 / 转移过程 / 实际使用
  @IsString() @IsNotEmpty() reviewConclusion: string;
}

class CreateStockDto {
  @IsString() @IsNotEmpty() researchGroup: string;
  @IsString() @IsNotEmpty() labLocation: string;
  @IsString() @IsNotEmpty() reagentId: string;
  @IsString() @IsNotEmpty() sourceBatchNo: string;
  @IsNumber() @Min(0.01) totalAmount: number;
  @IsString() @IsNotEmpty() expiryDate: string;
  @IsOptional() @IsBoolean() opened?: boolean;
  @IsOptional() @IsString() openedAt?: string;
}

const RISK_SOURCE_LABEL: Record<string, string> = {
  借用本身: '借用本身',
  转移过程: '转移过程',
  实际使用: '实际使用',
};

@Controller('borrow')
export class BorrowController {
  constructor(
    @InjectRepository(BorrowRequest) private borrows: Repository<BorrowRequest>,
    @InjectRepository(BorrowApproval) private approvals: Repository<BorrowApproval>,
    @InjectRepository(GroupReagentStock) private stocks: Repository<GroupReagentStock>,
    @InjectRepository(ReagentCatalog) private catalog: Repository<ReagentCatalog>,
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
    @InjectRepository(DispenseRecord) private dispenses: Repository<DispenseRecord>,
    @InjectRepository(UsageLog) private usageLogs: Repository<UsageLog>,
    @InjectRepository(WasteRecord) private wasteRecords: Repository<WasteRecord>,
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    @InjectRepository(User) private users: Repository<User>,
    private dataSource: DataSource,
  ) {}

  // ==================== 组间暂存库存 ====================

  // 新建借用前：可借库存（仅同楼层、他组、有余量、未过期）+ 借入方导师
  @Get('new-options')
  @Roles(Role.STUDENT)
  async newOptions(@CurrentUser() me: any) {
    const student = await this.users.findOne({ where: { id: me.sub } });
    if (!student) throw new NotFoundException('用户不存在');
    if (!student.labLocation) throw new BadRequestException('当前账号未设置实验室位置，无法判断同楼层，请联系管理员');
    const myFloor = floorOf(student.labLocation);
    const all = await this.stocks.find({ where: { status: '在用' }, order: { createdAt: 'DESC' } });
    const today = todayStr();
    const stocks = all.filter(
      (s) =>
        s.researchGroup !== student.researchGroup &&
        s.remainingAmount > 0 &&
        s.expiryDate >= today &&
        floorOf(s.labLocation) === myFloor,
    );
    const advisors = (await this.users.find({ where: { role: Role.ADVISOR } })).filter(
      (a) => a.researchGroup === student.researchGroup,
    );
    return {
      borrower: {
        id: student.id,
        name: student.name,
        college: student.college,
        researchGroup: student.researchGroup,
        labLocation: student.labLocation,
        labFacility: student.labFacility,
        dangerClearance: student.dangerClearance || [],
        floor: myFloor,
      },
      advisors,
      stocks,
    };
  }

  // 五要素风险预研判（选试剂/填数量时实时反馈）
  @Post('risk-preview')
  @Roles(Role.STUDENT)
  async riskPreview(@Body() dto: RiskPreviewDto, @CurrentUser() me: any) {
    const ctx = await this.buildContext(me.sub, dto.stockId, dto.amount);
    return {
      risk: ctx.risk,
      stock: ctx.stock,
      lenderAdvisor: ctx.lenderAdvisor,
      borrowerAdvisor: ctx.borrowerAdvisor,
      borrowerFacility: ctx.borrowerFacility,
    };
  }

  // 库管/安全员查看全部课题组暂存
  @Get('stocks')
  @Roles(Role.KEEPER, Role.SAFETY, Role.ADMIN)
  stockList() {
    return this.stocks.find({ order: { labLocation: 'ASC', reagentName: 'ASC' } });
  }

  // 库管登记课题组暂存（他组从库房领出后、存放本组实验室可外借的余量）
  @Post('stocks')
  @Roles(Role.KEEPER, Role.ADMIN)
  async createStock(@Body() dto: CreateStockDto) {
    const reagent = await this.catalog.findOne({ where: { id: dto.reagentId } });
    if (!reagent) throw new BadRequestException('试剂不存在');
    if (!floorOf(dto.labLocation)) throw new BadRequestException('实验室位置无法识别楼层（如：化学楼301）');
    const holder = (await this.users.find({ where: { role: Role.ADVISOR } })).find(
      (u) => u.researchGroup === dto.researchGroup,
    );
    const stock = this.stocks.create({
      researchGroup: dto.researchGroup,
      college: holder?.college || null,
      labLocation: dto.labLocation,
      reagentId: reagent.id,
      reagentName: reagent.name,
      casNo: reagent.casNo,
      dangerCategories: reagent.dangerCategories || [],
      storageCondition: reagent.storageCondition,
      unit: reagent.unit,
      maxSingleAmount: reagent.maxSingleAmount ?? null,
      sourceBatchNo: dto.sourceBatchNo,
      totalAmount: dto.totalAmount,
      remainingAmount: dto.totalAmount,
      opened: !!dto.opened,
      openedAt: dto.opened ? (dto.openedAt ? new Date(dto.openedAt) : new Date()) : null,
      expiryDate: dto.expiryDate,
      holderClearance: holder?.dangerClearance || [],
      status: '在用',
    });
    return this.stocks.save(stock);
  }

  // ==================== 借用申请 ====================

  @Post()
  @Roles(Role.STUDENT)
  async create(@Body() dto: CreateBorrowDto, @CurrentUser() me: any) {
    const ctx = await this.buildContext(me.sub, dto.stockId, dto.amount);
    const { stock, risk, student, borrowerAdvisor, lenderAdvisor } = ctx;

    if (risk.blocked) {
      const hard = risk.factors.filter((f) => !f.pass).map((f) => `【${f.label}】${f.detail}`);
      throw new BadRequestException(`该借用申请未通过风险比较，禁止发起：${hard.join('；')}`);
    }
    if (dto.amount > stock.remainingAmount) throw new BadRequestException('借出方暂存量不足');

    const count = await this.borrows.count();
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const borrow = this.borrows.create({
      borrowNo: `BRW-${ymd}-${String(count + 1).padStart(4, '0')}`,
      borrowerStudentId: student.id,
      borrowerStudentName: student.name,
      borrowerCollege: student.college,
      borrowerGroup: student.researchGroup,
      borrowerLabLocation: student.labLocation,
      borrowerAdvisorId: borrowerAdvisor.id,
      borrowerAdvisorName: borrowerAdvisor.name,
      borrowerAdvisorClearance: borrowerAdvisor.dangerClearance || [],
      borrowerStudentClearance: student.dangerClearance || [],
      lenderGroup: stock.researchGroup,
      lenderCollege: stock.college,
      lenderLabLocation: stock.labLocation,
      lenderAdvisorId: lenderAdvisor.id,
      lenderAdvisorName: lenderAdvisor.name,
      lenderClearance: lenderAdvisor.dangerClearance || [],
      stockId: stock.id,
      reagentId: stock.reagentId,
      reagentName: stock.reagentName,
      casNo: stock.casNo,
      dangerCategories: stock.dangerCategories,
      storageCondition: stock.storageCondition,
      unit: stock.unit,
      maxSingleAmount: stock.maxSingleAmount ?? null,
      amount: dto.amount,
      sourceBatchNo: stock.sourceBatchNo,
      opened: stock.opened,
      openedAt: stock.openedAt,
      expiryDate: stock.expiryDate,
      projectName: dto.projectName,
      purpose: dto.purpose || null,
      riskLevel: risk.level,
      riskFactors: risk.factors,
      blocked: false,
      riskSummary: risk.factors.map((f) => `${f.label}：${f.detail}`).join('；'),
      status: BorrowStatus.PENDING_BORROWER_ADVISOR,
    });
    const saved = await this.borrows.save(borrow);
    await this.log(saved.id, 'apply', { sub: student.id, name: student.name }, Role.STUDENT, 'submit', `发起跨组借用申请，实际使用项目：${dto.projectName}`, {
      riskLevel: risk.level,
    });
    return saved;
  }

  // ==================== 列表 / 详情 ====================

  @Get()
  async list(@CurrentUser() me: any, @Query('status') status?: string, @Query('scope') scope?: string) {
    const all = await this.borrows.find({ order: { createdAt: 'DESC' } });
    let list = all;
    if (me.role === Role.STUDENT) list = all.filter((b) => b.borrowerStudentId === me.sub);
    else if (me.role === Role.ADVISOR)
      list = all.filter((b) => b.borrowerAdvisorId === me.sub || b.lenderAdvisorId === me.sub);
    if (status) list = list.filter((b) => b.status === status);
    if (scope === 'todo') {
      list = list.filter((b) => {
        if (me.role === Role.ADVISOR)
          return (
            (b.status === BorrowStatus.PENDING_BORROWER_ADVISOR && b.borrowerAdvisorId === me.sub) ||
            (b.status === BorrowStatus.PENDING_LENDER_ADVISOR && b.lenderAdvisorId === me.sub)
          );
        if (me.role === Role.SAFETY) return b.status === BorrowStatus.PENDING_SAFETY;
        if (me.role === Role.KEEPER)
          return [BorrowStatus.DISPENSE_READY, BorrowStatus.TRANSFER_PLANNED].includes(b.status as BorrowStatus);
        return false;
      });
    }
    return list;
  }

  // ==================== 安全员复盘看板：按三来源聚合风险事件 ====================
  @Get('review-board')
  @Roles(Role.SAFETY, Role.ADMIN)
  async reviewBoard() {
    const [borrows, anomalies] = await Promise.all([
      this.borrows.find({ order: { updatedAt: 'DESC' } }),
      this.anomalies.find({ where: [{ type: AnomalyType.BORROW_RISK }, { type: AnomalyType.BORROW_TRANSFER_RISK }, { type: AnomalyType.BORROW_USAGE_RISK }] }),
    ]);
    // 借用相关的超量/洒漏事件也纳入实际使用来源
    const tagged = await this.anomalies.find({ where: { borrowId: In(borrows.map((b) => b.id)) } });
    const all = [...anomalies, ...tagged.filter((a) => !anomalies.some((x) => x.id === a.id))];

    const bySource = (src: string) => all.filter((a) => (a.riskSource || '借用本身') === src);
    const stat = (src: string) => {
      const list = bySource(src);
      return {
        source: src,
        total: list.length,
        open: list.filter((a) => a.status === 'OPEN').length,
        resolved: list.filter((a) => a.status === 'RESOLVED').length,
        events: list.slice(0, 20),
      };
    };
    return {
      counts: {
        totalBorrow: borrows.length,
        closed: borrows.filter((b) => b.status === BorrowStatus.CLOSED).length,
        pendingHandover: borrows.filter((b) =>
          [BorrowStatus.DISPENSE_READY, BorrowStatus.TRANSFER_PLANNED, BorrowStatus.IN_USE, BorrowStatus.USAGE_LOGGED, BorrowStatus.WASTE_ASSIGNED].includes(b.status as BorrowStatus),
        ).length,
        pendingReview: borrows.filter((b) =>
          [BorrowStatus.USAGE_LOGGED, BorrowStatus.WASTE_ASSIGNED].includes(b.status as BorrowStatus),
        ).length,
      },
      sources: ['借用本身', '转移过程', '实际使用'].map(stat),
      closed: borrows
        .filter((b) => b.status === BorrowStatus.CLOSED && b.reviewRiskSource)
        .slice(0, 30)
        .map((b) => ({
          borrowNo: b.borrowNo,
          reagentName: b.reagentName,
          amount: b.amount,
          unit: b.unit,
          borrowerGroup: b.borrowerGroup,
          lenderGroup: b.lenderGroup,
          reviewRiskSource: b.reviewRiskSource,
          reviewConclusion: b.reviewConclusion,
          reviewByName: b.reviewByName,
          reviewedAt: b.reviewedAt,
        })),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    this.assertVisible(b, me);
    const approvals = await this.approvals.find({ where: { borrowId: id }, order: { createdAt: 'ASC' } });
    let dispense = null;
    let usageLogs: UsageLog[] = [];
    let wasteRecords: WasteRecord[] = [];
    let requisition: Requisition | null = null;
    if (b.usageRequisitionId) {
      requisition = await this.reqs.findOne({ where: { id: b.usageRequisitionId } });
      dispense = await this.dispenses.findOne({ where: { requisitionId: b.usageRequisitionId } });
      usageLogs = await this.usageLogs.find({ where: { requisitionId: b.usageRequisitionId }, order: { createdAt: 'ASC' } });
      wasteRecords = await this.wasteRecords.find({ where: { requisitionId: b.usageRequisitionId }, order: { createdAt: 'ASC' } });
    }
    const anomalies = await this.anomalies.find({ where: { borrowId: id }, order: { createdAt: 'ASC' } });
    return {
      borrow: b,
      approvals,
      requisition,
      dispense,
      usageLogs,
      wasteRecords,
      anomalies,
      stages: this.buildStages(b, approvals),
    };
  }

  // ==================== 三级审批 ====================

  // 借入方导师：确认实验必要性与本组学生资质
  @Post(':id/borrower-advisor-decision')
  @Roles(Role.ADVISOR, Role.ADMIN)
  async borrowerAdvisorDecision(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (b.status !== BorrowStatus.PENDING_BORROWER_ADVISOR) throw new BadRequestException('当前状态不可借入方导师审批');
    if (me.role === Role.ADVISOR && b.borrowerAdvisorId !== me.sub) throw new ForbiddenException('仅借入方导师可审批');
    return this.finishDecision(
      b,
      dto,
      me,
      BorrowApprover.BORROWER_ADVISOR,
      '借入方导师',
      BorrowStatus.PENDING_LENDER_ADVISOR,
      '借入方导师驳回',
    );
  }

  // 借出方导师：同意让出本组暂存试剂
  @Post(':id/lender-advisor-decision')
  @Roles(Role.ADVISOR, Role.ADMIN)
  async lenderAdvisorDecision(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (b.status !== BorrowStatus.PENDING_LENDER_ADVISOR) throw new BadRequestException('当前状态不可借出方导师审批');
    if (me.role === Role.ADVISOR && b.lenderAdvisorId !== me.sub) throw new ForbiddenException('仅借出方导师可审批');
    return this.finishDecision(
      b,
      dto,
      me,
      BorrowApprover.LENDER_ADVISOR,
      '借出方导师',
      BorrowStatus.PENDING_SAFETY,
      '借出方导师驳回',
    );
  }

  // 安全员：确认转移路线与交接时间（最后一道风险关）
  @Post(':id/safety-decision')
  @Roles(Role.SAFETY, Role.ADMIN)
  async safetyDecision(@Param('id') id: string, @Body() dto: SafetyDecisionDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (b.status !== BorrowStatus.PENDING_SAFETY) throw new BadRequestException('当前状态不可安全员审批');

    if (dto.approve) {
      if (!dto.transferRoute?.trim()) throw new BadRequestException('请明确转移路线（起止房间、途经通道、转运容器）');
      if (!dto.transferContainer?.trim()) throw new BadRequestException('请指定防泄漏转运容器');
      if (!dto.handoverTime) throw new BadRequestException('请确认交接时间');
      if (!dto.handoverLocation?.trim()) throw new BadRequestException('请确认交接地点');
      if (!sameFloor(b.borrowerLabLocation, b.lenderLabLocation)) {
        throw new BadRequestException('双方实验室不在同楼层，安全员不得批准跨楼层转移');
      }
      b.transferRoute = dto.transferRoute;
      b.transferContainer = dto.transferContainer;
      b.handoverTime = new Date(dto.handoverTime);
      b.handoverLocation = dto.handoverLocation;
      b.safetyOfficerId = me.sub;
      b.safetyOfficerName = me.name;
      b.status = BorrowStatus.DISPENSE_READY;
    } else {
      b.status = BorrowStatus.REJECTED;
      b.rejectReason = dto.comment || '安全员驳回（转移路线/交接风险不可控）';
    }
    await this.borrows.save(b);
    await this.log(b.id, BorrowApprover.SAFETY, me, Role.SAFETY, dto.approve ? 'approve' : 'reject', dto.comment, {
      transferRoute: b.transferRoute,
      transferContainer: b.transferContainer,
      handoverTime: b.handoverTime,
      handoverLocation: b.handoverLocation,
    });

    // 安全员对「借用本身」高风险保留人工拦截：高风险经其批准时记录一条已识别风险事件（复盘可见）
    if (dto.approve && ([BorrowRiskLevel.HIGH, BorrowRiskLevel.CRITICAL] as string[]).includes(b.riskLevel)) {
      await this.createAnomalyIfAbsent({
        type: AnomalyType.BORROW_RISK,
        borrowId: b.id,
        requisitionId: null,
        riskSource: '借用本身',
        description: `${b.borrowNo} 借用本身为${b.riskLevel === 'CRITICAL' ? '极高' : '高'}风险（${b.reagentName} ${b.amount}${b.unit}，${b.borrowerGroup}←${b.lenderGroup}），安全员已评估并批准：${b.riskSummary}`,
        status: 'RESOLVED', // 已在审批环节识别并管控，默认闭环，复盘时可再次引用
        resolution: `安全员 ${me.name} 审批通过，已落实路线/交接管控`,
        resolvedById: me.sub,
        resolvedByName: me.name,
        resolvedAt: new Date(),
      });
    }
    return b;
  }

  // ==================== 库房发放同步 + 现场交接 ====================

  // 库管「组间余流发放」：扣减借出组暂存、生成实际使用单与发放凭证（同步到库房发放台账）
  @Post(':id/dispense')
  @Roles(Role.KEEPER, Role.ADMIN)
  async dispense(@Param('id') id: string, @Body() dto: DispenseBorrowDto, @CurrentUser() me: any) {
    return this.dataSource.transaction(async (em) => {
      const b = await em.getRepository(BorrowRequest).findOne({ where: { id } });
      if (!b) throw new NotFoundException('借用单不存在');
      if (b.status !== BorrowStatus.DISPENSE_READY) throw new BadRequestException('当前状态不可办理组间余流发放');
      if (needDualPickup(b.dangerCategories) && !dto.secondPickerName?.trim()) {
        throw new BadRequestException('该试剂属易制毒/易制爆/剧毒类，必须双人交接，请填写第二领取人');
      }

      const stock = await em.getRepository(GroupReagentStock).findOne({
        where: { id: b.stockId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!stock || stock.remainingAmount < b.amount) throw new BadRequestException('借出组暂存余量不足');

      // 生成「实际使用单」：归属借入方课题组/项目，后续使用登记、废液入库全部挂此单
      const seq = await em.getRepository(Requisition).count();
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const req = em.getRepository(Requisition).create({
        reqNo: `REQ-B${ymd}-${String(seq + 1).padStart(4, '0')}`,
        sourceType: 'BORROW',
        borrowId: b.id,
        studentId: b.borrowerStudentId,
        studentName: b.borrowerStudentName,
        college: b.borrowerCollege,
        researchGroup: b.borrowerGroup,
        projectName: b.projectName,
        advisorId: b.borrowerAdvisorId,
        advisorName: b.borrowerAdvisorName,
        reagentId: b.reagentId,
        reagentName: b.reagentName,
        casNo: b.casNo,
        concentration: `跨组借自${b.lenderGroup}（批号 ${b.sourceBatchNo}）`,
        estimatedAmount: b.amount,
        unit: b.unit,
        location: b.borrowerLabLocation,
        plannedStart: b.handoverTime || new Date(),
        plannedEnd: b.handoverTime || new Date(),
        teamMembers: dto.secondPickerName || null,
        dangerCategories: b.dangerCategories,
        requiresDualPickup: needDualPickup(b.dangerCategories),
        maxSingleAmount: b.maxSingleAmount,
        fumeHoodCode: null,
        safetyChecklist: { borrowRiskControlled: true },
        status: ReqStatus.IN_USE, // 组间余流发放即出库，直接进入使用中，不进入库房待出库队列
      });
      await em.getRepository(Requisition).save(req);

      // 发放凭证（同步到库房发放台账：库管可见组间余流出口）
      const record = em.getRepository(DispenseRecord).create({
        requisitionId: req.id,
        sourceType: 'GROUP_BORROW',
        borrowId: b.id,
        batchId: stock.id,
        batchNo: stock.sourceBatchNo,
        warehouseName: `组间余流·${stock.researchGroup}（${stock.labLocation}）`,
        amount: b.amount,
        remainingAfter: +(stock.remainingAmount - b.amount).toFixed(4),
        unit: b.unit,
        expiryDate: b.expiryDate,
        opened: b.opened,
        pickerName: b.borrowerStudentName,
        secondPickerName: dto.secondPickerName || null,
        keeperId: me.sub,
        keeperName: me.name,
      });
      await em.getRepository(DispenseRecord).save(record);

      stock.remainingAmount = +(stock.remainingAmount - b.amount).toFixed(4);
      if (stock.remainingAmount <= 0) stock.status = '用尽';
      await em.getRepository(GroupReagentStock).save(stock);

      b.usageRequisitionId = req.id;
      b.status = BorrowStatus.TRANSFER_PLANNED;
      await em.getRepository(BorrowRequest).save(b);
      await em.getRepository(BorrowApproval).save(
        em.getRepository(BorrowApproval).create({
          borrowId: b.id,
          node: 'dispense',
          nodeLabel: '库房发放同步（组间余流）',
          actorId: me.sub,
          actorName: me.name,
          actorRole: me.role,
          action: 'dispense',
          comment: `发放台账已同步：${stock.sourceBatchNo} 流出 ${b.amount}${b.unit}，实际使用单 ${req.reqNo}`,
          extra: { requisitionId: req.id, remainingAfter: record.remainingAfter, secondPickerName: dto.secondPickerName || null },
        }),
      );
      return { borrow: b, dispense: record, requisition: req };
    });
  }

  // 现场交接：双方签字、安全员/库管监督；发现问题自动转「转移过程」风险事件
  @Post(':id/handover')
  @Roles(Role.KEEPER, Role.SAFETY, Role.ADMIN)
  async handover(@Param('id') id: string, @Body() dto: HandoverDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (b.status !== BorrowStatus.TRANSFER_PLANNED) throw new BadRequestException('当前状态不可交接（须先完成组间余流发放）');
    if (needDualPickup(b.dangerCategories) && dto.handoverBorrowerName === dto.handoverLenderName) {
      throw new BadRequestException('危险试剂交接双方不能为同一人，请落实双人交接');
    }
    b.handedOverAt = new Date();
    b.handoverBorrowerName = dto.handoverBorrowerName;
    b.handoverLenderName = dto.handoverLenderName;
    b.handoverKeeperId = me.sub;
    b.handoverKeeperName = me.name;
    b.dualHandover = needDualPickup(b.dangerCategories);
    b.status = BorrowStatus.IN_USE;
    await this.borrows.save(b);

    if (b.usageRequisitionId) await this.reqs.update({ id: b.usageRequisitionId }, { status: ReqStatus.IN_USE });

    await this.log(b.id, 'handover', me, me.role, 'handover', `现场交接完成：借入方 ${dto.handoverBorrowerName} / 借出方 ${dto.handoverLenderName}`, {
      handoverBorrowerName: dto.handoverBorrowerName,
      handoverLenderName: dto.handoverLenderName,
      issue: dto.issue || null,
    });

    if (dto.issue?.trim()) {
      await this.createAnomalyIfAbsent({
        type: AnomalyType.BORROW_TRANSFER_RISK,
        borrowId: b.id,
        requisitionId: b.usageRequisitionId,
        riskSource: '转移过程',
        description: `${b.borrowNo} 现场交接发现问题：${dto.issue}（路线：${b.transferRoute}，交接地点：${b.handoverLocation}）`,
        status: 'OPEN',
      });
    }
    return b;
  }

  // ==================== 使用登记（实际使用项目）====================

  @Post(':id/usage')
  @Roles(Role.STUDENT)
  async usage(@Param('id') id: string, @Body() dto: UsageBorrowDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (b.borrowerStudentId !== me.sub) throw new ForbiddenException('仅借入申请人可登记实际使用');
    if (b.status !== BorrowStatus.IN_USE) throw new BadRequestException('当前状态不可登记使用（须完成现场交接）');
    if (dto.usedAmount + dto.returnedAmount > b.amount + 0.001) {
      throw new BadRequestException(`实际使用 ${dto.usedAmount}+归还 ${dto.returnedAmount} 超过借入量 ${b.amount}${b.unit}`);
    }
    if (!b.usageRequisitionId) throw new BadRequestException('缺少实际使用单，数据异常，请联系库管');

    const logEntry = await this.usageLogs.save(
      this.usageLogs.create({
        requisitionId: b.usageRequisitionId,
        actualAmount: dto.usedAmount,
        remainingAmount: dto.returnedAmount,
        unit: b.unit,
        spillDesc: dto.spillDesc || null,
        wasteType: dto.wasteType || null,
        wasteAmount: dto.wasteAmount ?? null,
        loggedById: me.sub,
        loggedByName: me.name,
      }),
    );

    // 风险事件：超量使用 / 洒漏 —— 归因到「实际使用」，并同时挂借用单与实际使用单
    if (dto.usedAmount > b.amount) {
      await this.createAnomalyIfAbsent({
        type: AnomalyType.OVER_USAGE,
        borrowId: b.id,
        requisitionId: b.usageRequisitionId,
        usageLogId: logEntry.id,
        riskSource: '实际使用',
        description: `借用试剂 ${b.reagentName} 实际使用 ${dto.usedAmount}${b.unit} 超过借入量 ${b.amount}${b.unit}（${b.borrowNo}，项目：${b.projectName}）`,
        status: 'OPEN',
      });
    }
    if (dto.spillDesc?.trim()) {
      await this.createAnomalyIfAbsent({
        type: AnomalyType.SPILL,
        borrowId: b.id,
        requisitionId: b.usageRequisitionId,
        usageLogId: logEntry.id,
        riskSource: '实际使用',
        description: `借用试剂使用中异常洒漏：${dto.spillDesc}（${b.borrowNo}，项目：${b.projectName}）`,
        status: 'OPEN',
      });
    }

    b.usedAmount = dto.usedAmount;
    b.returnedAmount = dto.returnedAmount;
    b.wasteType = dto.wasteType || null;
    b.wasteAmount = dto.wasteAmount ?? null;
    b.status = BorrowStatus.USAGE_LOGGED;
    await this.borrows.save(b);
    await this.reqs.update({ id: b.usageRequisitionId }, { status: ReqStatus.USAGE_LOGGED });
    await this.log(b.id, 'usage', me, Role.STUDENT, 'usage',
      `实际使用 ${dto.usedAmount}${b.unit}，余量归还 ${dto.returnedAmount}${b.unit}${dto.wasteAmount ? `，产生废液 ${dto.wasteType} ${dto.wasteAmount}ml（责任拆回 ${b.borrowerGroup}）` : ''}`,
      { usageLogId: logEntry.id },
    );
    return logEntry;
  }

  // ==================== 安全员复盘：风险三来源归因 + 闭环 ====================

  @Post(':id/review')
  @Roles(Role.SAFETY, Role.ADMIN)
  async review(@Param('id') id: string, @Body() dto: ReviewBorrowDto, @CurrentUser() me: any) {
    const b = await this.getBorrow(id);
    if (![BorrowStatus.USAGE_LOGGED, BorrowStatus.WASTE_ASSIGNED].includes(b.status as BorrowStatus)) {
      throw new BadRequestException('当前状态不可复盘（须完成使用登记；产生废液的须先拆回入库）');
    }
    if (!RISK_SOURCE_LABEL[dto.reviewRiskSource]) throw new BadRequestException('风险来源须为：借用本身 / 转移过程 / 实际使用');
    if (b.wasteAmount && b.status !== BorrowStatus.WASTE_ASSIGNED) {
      throw new BadRequestException('该借用已登记产生废液，但废液尚未拆回到实际使用项目入库，不能闭环');
    }

    b.reviewRiskSource = dto.reviewRiskSource;
    b.reviewConclusion = dto.reviewConclusion;
    b.reviewById = me.sub;
    b.reviewByName = me.name;
    b.reviewedAt = new Date();
    b.status = BorrowStatus.CLOSED;
    await this.borrows.save(b);
    if (b.usageRequisitionId) await this.reqs.update({ id: b.usageRequisitionId }, { status: ReqStatus.CLOSED });
    await this.log(b.id, 'review', me, Role.SAFETY, 'review',
      `复盘结论：风险来自「${dto.reviewRiskSource}」。${dto.reviewConclusion}`,
      { reviewRiskSource: dto.reviewRiskSource },
    );
    return b;
  }

  // 复盘看板已前置（避免被 :id 路由截获）

  // ==================== helpers ====================

  private async buildContext(studentId: string, stockId: string, amount: number) {
    const student = await this.users.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('用户不存在');
    const stock = await this.stocks.findOne({ where: { id: stockId } });
    if (!stock) throw new BadRequestException('借出方暂存试剂不存在或已下架');
    if (stock.status !== '在用' || stock.remainingAmount <= 0) throw new BadRequestException('该暂存试剂已无可借余量');
    if (stock.expiryDate < todayStr()) throw new BadRequestException('该批次已过有效期，禁止借用');
    if (stock.researchGroup === student.researchGroup) throw new BadRequestException('同组内无需走跨组借用流程');
    if (!sameFloor(stock.labLocation, student.labLocation)) {
      throw new BadRequestException(
        `仅允许向同楼层实验室借用（借出方 ${stock.labLocation} / 借入方 ${student.labLocation}）`,
      );
    }
    const borrowerAdvisor = (await this.users.find({ where: { role: Role.ADVISOR } })).find(
      (u) => u.researchGroup === student.researchGroup,
    );
    if (!borrowerAdvisor) throw new BadRequestException('借入方课题组未配置导师，无法发起借用');
    const lenderAdvisor = (await this.users.find({ where: { role: Role.ADVISOR } })).find(
      (u) => u.researchGroup === stock.researchGroup,
    );
    if (!lenderAdvisor) throw new BadRequestException('借出方课题组未配置导师，无法发起借用');

    const borrowerFacility = student.labFacility || borrowerAdvisor.labFacility || '';
    const openedDaysAgo = stock.opened && stock.openedAt
      ? Math.floor((Date.now() - new Date(stock.openedAt).getTime()) / 86400000)
      : null;
    const risk = assessBorrowRisk({
      categories: stock.dangerCategories || [],
      opened: stock.opened,
      openedDaysAgo,
      storageRequired: stock.storageCondition || '',
      borrowerFacility,
      amount,
      maxSingleAmount: stock.maxSingleAmount,
      lenderClearance: lenderAdvisor.dangerClearance || [],
      borrowerAdvisorClearance: borrowerAdvisor.dangerClearance || [],
      studentClearance: student.dangerClearance || [],
      sameBuildingFloor: sameFloor(stock.labLocation, student.labLocation),
    });
    return { student, stock, borrowerAdvisor, lenderAdvisor, borrowerFacility, risk };
  }

  private async finishDecision(
    b: BorrowRequest,
    dto: DecisionDto,
    me: any,
    node: string,
    nodeLabel: string,
    nextStatus: BorrowStatus,
    rejectText: string,
  ) {
    await this.approvals.save(
      this.approvals.create({
        borrowId: b.id,
        node,
        nodeLabel,
        actorId: me.sub,
        actorName: me.name,
        actorRole: me.role,
        action: dto.approve ? 'approve' : 'reject',
        comment: dto.comment || null,
      }),
    );
    b.status = dto.approve ? nextStatus : BorrowStatus.REJECTED;
    if (!dto.approve) b.rejectReason = dto.comment || rejectText;
    return this.borrows.save(b);
  }

  private async log(
    borrowId: string,
    node: string,
    actor: { sub: string; name: string },
    role: string,
    action: string,
    comment: string,
    extra?: Record<string, any>,
  ) {
    const labels: Record<string, string> = {
      apply: '提交借用申请',
      [BorrowApprover.BORROWER_ADVISOR]: '借入方导师',
      [BorrowApprover.LENDER_ADVISOR]: '借出方导师',
      [BorrowApprover.SAFETY]: '安全员确认路线与交接',
      dispense: '库房发放同步',
      handover: '现场交接',
      usage: '实际使用登记',
      review: '安全员复盘',
    };
    await this.approvals.save(
      this.approvals.create({
        borrowId,
        node,
        nodeLabel: labels[node] || node,
        actorId: actor.sub,
        actorName: actor.name,
        actorRole: role,
        action,
        comment,
        extra: extra || null,
      }),
    );
  }

  private async getBorrow(id: string) {
    const b = await this.borrows.findOne({ where: { id } });
    if (!b) throw new NotFoundException('借用单不存在');
    return b;
  }

  private assertVisible(b: BorrowRequest, me: any) {
    if ([Role.ADMIN, Role.SAFETY, Role.KEEPER, Role.COLLEGE].includes(me.role as Role)) return;
    if (me.role === Role.STUDENT && b.borrowerStudentId === me.sub) return;
    if (me.role === Role.ADVISOR && (b.borrowerAdvisorId === me.sub || b.lenderAdvisorId === me.sub)) return;
    throw new ForbiddenException('无权查看该借用单');
  }

  private async createAnomalyIfAbsent(data: Partial<Anomaly>) {
    const where: any = { borrowId: data.borrowId, type: data.type, status: 'OPEN' };
    if (data.status === 'OPEN') {
      const dup = await this.anomalies.findOne({ where });
      if (dup) return dup;
    }
    return this.anomalies.save(this.anomalies.create(data));
  }

  private buildStages(b: BorrowRequest, approvals: BorrowApproval[]) {
    const find = (node: string) => approvals.find((a) => a.node === node);
    const findAction = (node: string, action: string) => approvals.find((a) => a.node === node && a.action === action);
    const rejectedNode = approvals.find((a) => a.action === 'reject');
    const mk = (key: string, label: string, done: boolean, time?: any, rejected = false, desc?: string) => ({
      key, label, done, time: time || null, rejected, desc,
    });
    return [
      mk('apply', '发起借用', true, b.createdAt),
      mk('borrowerAdvisor', '借入方导师', !!findAction(BorrowApprover.BORROWER_ADVISOR, 'approve'),
        find(BorrowApprover.BORROWER_ADVISOR)?.createdAt, rejectedNode?.node === BorrowApprover.BORROWER_ADVISOR),
      mk('lenderAdvisor', '借出方导师', !!findAction(BorrowApprover.LENDER_ADVISOR, 'approve'),
        find(BorrowApprover.LENDER_ADVISOR)?.createdAt, rejectedNode?.node === BorrowApprover.LENDER_ADVISOR),
      mk('safety', '安全员定路线/时间', !!findAction(BorrowApprover.SAFETY, 'approve'),
        find(BorrowApprover.SAFETY)?.createdAt, rejectedNode?.node === BorrowApprover.SAFETY,
        b.transferRoute ? `${b.transferRoute}｜${b.handoverLocation}` : ''),
      mk('dispense', '库房发放同步', !!find('dispense'), find('dispense')?.createdAt),
      mk('handover', '现场交接', !!find('handover'), b.handedOverAt, false,
        b.handedOverAt ? `${b.handoverLenderName} → ${b.handoverBorrowerName}` : ''),
      mk('usage', '实际使用', [BorrowStatus.USAGE_LOGGED, BorrowStatus.WASTE_ASSIGNED, BorrowStatus.CLOSED].includes(b.status as BorrowStatus),
        find('usage')?.createdAt),
      mk('waste', '废液责任拆回', !!b.wasteAmount ? b.status === BorrowStatus.WASTE_ASSIGNED || b.status === BorrowStatus.CLOSED : true,
        null, false, b.wasteAmount ? `${b.wasteType} ${b.wasteAmount}ml → ${b.borrowerGroup}` : '无废液'),
      mk('review', '复盘闭环', b.status === BorrowStatus.CLOSED, b.reviewedAt, false,
        b.reviewRiskSource ? `风险来自：${b.reviewRiskSource}` : ''),
    ];
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BorrowRequest,
      BorrowApproval,
      GroupReagentStock,
      ReagentCatalog,
      Requisition,
      DispenseRecord,
      UsageLog,
      WasteRecord,
      Anomaly,
      User,
    ]),
  ],
  controllers: [BorrowController],
})
export class BorrowModule {}
