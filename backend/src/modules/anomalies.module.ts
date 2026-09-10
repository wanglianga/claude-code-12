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
import { IsNotEmpty, IsString } from 'class-validator';
import { LessThan, Repository } from 'typeorm';
import { Anomaly, InventoryBatch, Requisition } from '../common/entities';
import { CurrentUser, Roles } from '../common/auth';
import { AnomalyType, Role, todayStr } from '../common/enums';

class ResolveDto {
  @IsString()
  @IsNotEmpty()
  resolution: string;
}

@Controller('anomalies')
export class AnomaliesController {
  constructor(
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    @InjectRepository(InventoryBatch) private batches: Repository<InventoryBatch>,
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
  ) {}

  @Get()
  async list(@CurrentUser() me: any, @Query('status') status?: string) {
    await this.sweepExpiredBatches();
    const where: any = {};
    if (status) where.status = status;
    const list = await this.anomalies.find({ where, order: { createdAt: 'DESC' } });
    if (me.role === Role.STUDENT) {
      const myReqs = await this.reqs.find({ where: { studentId: me.sub } });
      const ids = new Set(myReqs.map((r) => r.id));
      return list.filter((a) => a.requisitionId && ids.has(a.requisitionId));
    }
    return list;
  }

  @Post(':id/resolve')
  @Roles(Role.SAFETY, Role.ADMIN)
  async resolve(@Param('id') id: string, @Body() dto: ResolveDto, @CurrentUser() me: any) {
    const anomaly = await this.anomalies.findOne({ where: { id } });
    if (!anomaly) throw new NotFoundException('异常不存在');
    if (anomaly.status !== 'OPEN') throw new BadRequestException('该异常已处理');
    anomaly.status = 'RESOLVED';
    anomaly.resolution = dto.resolution;
    anomaly.resolvedById = me.sub;
    anomaly.resolvedByName = me.name;
    anomaly.resolvedAt = new Date();
    return this.anomalies.save(anomaly);
  }

  // 巡检：库内有过期且有余量的批次 -> 生成试剂过期异常（去重）
  private async sweepExpiredBatches() {
    const expired = await this.batches.find({
      where: { expiryDate: LessThan(todayStr()), status: '在库' },
    });
    for (const b of expired.filter((x) => x.remainingAmount > 0)) {
      const dup = await this.anomalies.findOne({
        where: { type: AnomalyType.REAGENT_EXPIRED, batchId: b.id, status: 'OPEN' },
      });
      if (!dup) {
        await this.anomalies.save(
          this.anomalies.create({
            type: AnomalyType.REAGENT_EXPIRED,
            batchId: b.id,
            description: `库存批次 ${b.batchNo}（${b.reagentName}，${b.warehouseName}）有效期至 ${b.expiryDate} 已过期，余量 ${b.remainingAmount}${b.unit}，请隔离处置`,
            status: 'OPEN',
          }),
        );
      }
    }
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Anomaly, InventoryBatch, Requisition])],
  controllers: [AnomaliesController],
})
export class AnomaliesModule {}
