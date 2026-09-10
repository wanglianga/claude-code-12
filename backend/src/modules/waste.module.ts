import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ArrayMinSize } from 'class-validator';
import { Anomaly, BorrowRequest, Requisition, TransferManifest, WasteBarrel, WasteRecord } from '../common/entities';
import { CurrentUser, Roles } from '../common/auth';
import {
  AnomalyType,
  BARREL_WARN_RATIO,
  BorrowStatus,
  ManifestStatus,
  ReqStatus,
  Role,
  WASTE_TYPES,
  WasteStatus,
} from '../common/enums';

class CreateBarrelDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() wasteType: string;
  @IsNumber() @Min(1) capacity: number;
  @IsOptional() @IsString() warehouseName?: string;
}

class StoreWasteDto {
  @IsString() @IsNotEmpty() wasteType: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() barrelId: string;
  @IsString() @IsNotEmpty() containerLabel: string;
}

class CreateManifestDto {
  @IsArray() @ArrayMinSize(1) wasteRecordIds: string[];
  @IsString() @IsNotEmpty() company: string;
  @IsNumber() @Min(0.01) totalWeight: number;
  @IsOptional() @IsArray() photoUrls?: string[];
}

class ReviewManifestDto {
  @IsNotEmpty() approve: boolean;
  @IsOptional() @IsString() comment?: string;
}

@Controller('waste')
export class WasteController {
  constructor(
    @InjectRepository(WasteBarrel) private barrels: Repository<WasteBarrel>,
    @InjectRepository(WasteRecord) private records: Repository<WasteRecord>,
    @InjectRepository(TransferManifest) private manifests: Repository<TransferManifest>,
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
    @InjectRepository(BorrowRequest) private borrows: Repository<BorrowRequest>,
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    private dataSource: DataSource,
  ) {}

  // ---------- 废液桶 ----------
  @Get('barrels')
  barrelList() {
    return this.barrels.find({ order: { code: 'ASC' } });
  }

  @Post('barrels')
  @Roles(Role.KEEPER, Role.ADMIN)
  async createBarrel(@Body() dto: CreateBarrelDto) {
    if (!WASTE_TYPES.includes(dto.wasteType)) throw new BadRequestException('未知废液类型');
    const dup = await this.barrels.findOne({ where: { code: dto.code } });
    if (dup) throw new BadRequestException('桶编号已存在');
    return this.barrels.save(
      this.barrels.create({ ...dto, currentAmount: 0, unit: 'ml', status: '在用' }),
    );
  }

  // ---------- 废液入库：匹配原试剂/实验项目/容器标签 ----------
  @Post('requisitions/:reqId/store')
  @Roles(Role.KEEPER, Role.ADMIN)
  async store(@Param('reqId') reqId: string, @Body() dto: StoreWasteDto, @CurrentUser() me: any) {
    return this.dataSource.transaction(async (em) => {
      const req = await em.getRepository(Requisition).findOne({ where: { id: reqId } });
      if (!req) throw new NotFoundException('申请单不存在');
      if (![ReqStatus.USAGE_LOGGED, ReqStatus.WASTE_STORED].includes(req.status as ReqStatus)) {
        throw new BadRequestException('需先完成使用登记才能办理废液入库');
      }
      const barrel = await em.getRepository(WasteBarrel).findOne({
        where: { id: dto.barrelId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!barrel) throw new BadRequestException('废液桶不存在');
      if (barrel.wasteType !== dto.wasteType) {
        throw new BadRequestException(`废液类型与桶不匹配（该桶接收：${barrel.wasteType}）`);
      }
      if (barrel.status === '已满') throw new BadRequestException('该废液桶已满，请更换');
      if (barrel.currentAmount + dto.amount > barrel.capacity) {
        throw new BadRequestException(`超出桶容量（剩余 ${barrel.capacity - barrel.currentAmount}ml）`);
      }

      const record = em.getRepository(WasteRecord).create({
        requisitionId: req.id,
        reqNo: req.reqNo,
        reagentName: req.reagentName, // 匹配原试剂
        projectName: req.projectName, // 匹配实验项目
        wasteType: dto.wasteType,
        amount: dto.amount,
        unit: 'ml',
        barrelId: barrel.id,
        barrelCode: barrel.code,
        containerLabel: dto.containerLabel, // 容器标签
        storedById: me.sub,
        storedByName: me.name,
        status: WasteStatus.STORED,
      });

      // ===== 跨组借用：废液责任拆回实际使用项目（借入方课题组），防止借用记录与废液记录分离 =====
      let linkedBorrow: BorrowRequest | null = null;
      if (req.sourceType === 'BORROW' && req.borrowId) {
        linkedBorrow = await em.getRepository(BorrowRequest).findOne({ where: { id: req.borrowId } });
        if (linkedBorrow) {
          record.sourceType = 'BORROW';
          record.borrowId = linkedBorrow.id;
          record.responsibleGroupName = linkedBorrow.borrowerGroup; // 实际使用课题组承担废液责任
          record.sourceGroupName = linkedBorrow.lenderGroup; // 试剂来源课题组仅留痕，不承担废液
        }
      } else {
        record.responsibleGroupName = req.researchGroup;
        record.sourceGroupName = req.researchGroup;
      }
      await em.getRepository(WasteRecord).save(record);

      barrel.currentAmount = +(barrel.currentAmount + dto.amount).toFixed(2);
      const ratio = barrel.currentAmount / barrel.capacity;
      if (ratio >= 1) barrel.status = '已满';
      else if (ratio >= BARREL_WARN_RATIO) barrel.status = '即将满载';
      await em.getRepository(WasteBarrel).save(barrel);

      // 异常触发：废液桶即将满载 / 已满
      if (ratio >= BARREL_WARN_RATIO) {
        const dup = await em.getRepository(Anomaly).findOne({
          where: { type: AnomalyType.BARREL_NEAR_FULL, barrelId: barrel.id, status: 'OPEN' },
        });
        if (!dup) {
          await em.getRepository(Anomaly).save(
            em.getRepository(Anomaly).create({
              type: AnomalyType.BARREL_NEAR_FULL,
              barrelId: barrel.id,
              requisitionId: req.id,
              reqNo: req.reqNo,
              description: `废液桶 ${barrel.code}（${barrel.wasteType}）液位 ${Math.round(ratio * 100)}%，${barrel.status}，请安排转运`,
              status: 'OPEN',
            }),
          );
        }
      }

      req.status = ReqStatus.WASTE_STORED;
      await em.getRepository(Requisition).save(req);

      // 借用单同步：废液已拆回实际使用项目（借入方课题组），等待安全员复盘闭环
      if (linkedBorrow) {
        linkedBorrow.status = BorrowStatus.WASTE_ASSIGNED;
        await em.getRepository(BorrowRequest).save(linkedBorrow);
      }
      return record;
    });
  }

  @Get('records')
  recordList(@Query('status') status?: string, @Query('requisitionId') requisitionId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (requisitionId) where.requisitionId = requisitionId;
    return this.records.find({ where, order: { createdAt: 'DESC' } });
  }

  // ---------- 转运单：关联危废公司/称重/交接照片 ----------
  @Post('manifests')
  @Roles(Role.KEEPER, Role.ADMIN)
  async createManifest(@Body() dto: CreateManifestDto, @CurrentUser() me: any) {
    const records = await this.records.findBy({ id: In(dto.wasteRecordIds) });
    if (records.length !== dto.wasteRecordIds.length) throw new BadRequestException('存在无效的废液记录');
    for (const r of records) {
      if (r.status !== WasteStatus.STORED || r.manifestId) {
        throw new BadRequestException(`废液记录 ${r.reqNo}/${r.containerLabel} 不在可转运状态`);
      }
    }
    const count = await this.manifests.count();
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const manifest = await this.manifests.save(
      this.manifests.create({
        manifestNo: `TRF-${ymd}-${String(count + 1).padStart(4, '0')}`,
        company: dto.company,
        totalWeight: dto.totalWeight,
        photoUrls: dto.photoUrls || [],
        status: ManifestStatus.PENDING_REVIEW,
        createdById: me.sub,
        createdByName: me.name,
      }),
    );
    await this.records.update({ id: In(records.map((r) => r.id)) }, { manifestId: manifest.id });
    return manifest;
  }

  @Get('manifests')
  async manifestList() {
    const list = await this.manifests.find({ order: { createdAt: 'DESC' } });
    const records = await this.records.find();
    return list.map((m) => ({ ...m, records: records.filter((r) => r.manifestId === m.id) }));
  }

  // ---------- 学院审核：通过后废液出库转运、链路闭环 ----------
  @Post('manifests/:id/review')
  @Roles(Role.COLLEGE, Role.ADMIN)
  async review(@Param('id') id: string, @Body() dto: ReviewManifestDto, @CurrentUser() me: any) {
    return this.dataSource.transaction(async (em) => {
      const manifest = await em.getRepository(TransferManifest).findOne({ where: { id } });
      if (!manifest) throw new NotFoundException('转运单不存在');
      if (manifest.status !== ManifestStatus.PENDING_REVIEW) throw new BadRequestException('该转运单已审核');
      manifest.reviewerId = me.sub;
      manifest.reviewerName = me.name;
      manifest.reviewComment = dto.comment || null;
      manifest.reviewedAt = new Date();

      const records = await em.getRepository(WasteRecord).findBy({ manifestId: id });
      if (dto.approve) {
        manifest.status = ManifestStatus.TRANSFERRED;
        for (const r of records) {
          r.status = WasteStatus.TRANSFERRED;
          await em.getRepository(WasteRecord).save(r);
          // 桶液位扣减
          const barrel = await em.getRepository(WasteBarrel).findOne({
            where: { id: r.barrelId },
            lock: { mode: 'pessimistic_write' },
          });
          if (barrel) {
            barrel.currentAmount = Math.max(0, +(barrel.currentAmount - r.amount).toFixed(2));
            const ratio = barrel.currentAmount / barrel.capacity;
            barrel.status = ratio >= 1 ? '已满' : ratio >= BARREL_WARN_RATIO ? '即将满载' : '在用';
            await em.getRepository(WasteBarrel).save(barrel);
          }
        }
        // 申请单闭环：其名下废液全部转运完成
        const reqIds = [...new Set(records.map((r) => r.requisitionId))];
        for (const reqId of reqIds) {
          const all = await em.getRepository(WasteRecord).find({ where: { requisitionId: reqId } });
          if (all.length > 0 && all.every((w) => w.status === WasteStatus.TRANSFERRED)) {
            await em.getRepository(Requisition).update({ id: reqId }, { status: ReqStatus.CLOSED });
          }
        }
      } else {
        manifest.status = ManifestStatus.REJECTED;
        for (const r of records) {
          r.manifestId = null;
          await em.getRepository(WasteRecord).save(r);
        }
      }
      await em.getRepository(TransferManifest).save(manifest);
      return manifest;
    });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([WasteBarrel, WasteRecord, TransferManifest, Requisition, BorrowRequest, Anomaly])],
  controllers: [WasteController],
})
export class WasteModule {}
