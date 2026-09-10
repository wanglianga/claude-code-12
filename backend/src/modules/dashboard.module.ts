import { Controller, Get, Module, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Anomaly,
  DispenseRecord,
  Requisition,
  TransferManifest,
  WasteBarrel,
  WasteRecord,
} from '../common/entities';
import { CurrentUser } from '../common/auth';
import { ManifestStatus, ReqStatus, Role, WasteStatus } from '../common/enums';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectRepository(Requisition) private reqs: Repository<Requisition>,
    @InjectRepository(Anomaly) private anomalies: Repository<Anomaly>,
    @InjectRepository(WasteBarrel) private barrels: Repository<WasteBarrel>,
    @InjectRepository(WasteRecord) private wasteRecords: Repository<WasteRecord>,
    @InjectRepository(TransferManifest) private manifests: Repository<TransferManifest>,
    @InjectRepository(DispenseRecord) private dispenses: Repository<DispenseRecord>,
  ) {}

  // 各角色待办/概览计数
  @Get('summary')
  async summary(@CurrentUser() me: any) {
    const [all, openAnomalies, barrels, pendingManifests, storedWaste] = await Promise.all([
      this.reqs.find(),
      this.anomalies.count({ where: { status: 'OPEN' } }),
      this.barrels.find(),
      this.manifests.count({ where: { status: ManifestStatus.PENDING_REVIEW } }),
      this.wasteRecords.count({ where: { status: WasteStatus.STORED } }),
    ]);
    const count = (fn: (r: Requisition) => boolean) => all.filter(fn).length;
    return {
      role: me.role,
      myTotal: count((r) => r.studentId === me.sub),
      myInProgress: count(
        (r) => r.studentId === me.sub && ![ReqStatus.CLOSED, ReqStatus.REJECTED, ReqStatus.CANCELLED].includes(r.status as ReqStatus),
      ),
      pendingAdvisor: count((r) => r.status === ReqStatus.PENDING_ADVISOR && (me.role !== Role.ADVISOR || r.advisorId === me.sub)),
      pendingSafety: count((r) => r.status === ReqStatus.PENDING_SAFETY),
      approvedToDispense: count((r) => r.status === ReqStatus.APPROVED),
      inUse: count((r) => [ReqStatus.IN_USE, ReqStatus.USAGE_LOGGED].includes(r.status as ReqStatus)),
      wasteStored: count((r) => r.status === ReqStatus.WASTE_STORED),
      closed: count((r) => r.status === ReqStatus.CLOSED),
      total: all.length,
      openAnomalies,
      barrelsWarn: barrels.filter((b) => b.status !== '在用').length,
      storedWasteRecords: storedWaste,
      pendingManifests,
    };
  }

  // 责任视图：按 学院 / 课题组 / 库房 / 危险等级 聚合
  @Get('responsibility')
  async responsibility(@Query('dim') dim: string) {
    const [reqs, anomalies, waste, dispenses] = await Promise.all([
      this.reqs.find(),
      this.anomalies.find({ where: { status: 'OPEN' } }),
      this.wasteRecords.find(),
      this.dispenses.find(),
    ]);
    const reqWarehouse: Record<string, string> = {};
    for (const d of dispenses) reqWarehouse[d.requisitionId] = d.warehouseName;

    // 一个申请可能命中多个危险类别 -> 多组计数
    const keyOf = (r: Requisition): string[] => {
      switch (dim) {
        case 'college':
          return [r.college || '未分配'];
        case 'group':
          return [r.researchGroup || '未分配'];
        case 'warehouse':
          return [reqWarehouse[r.id] || '（未出库）'];
        case 'danger':
          return r.dangerCategories?.length ? r.dangerCategories : ['普通试剂'];
        default:
          return ['全部'];
      }
    };

    const groups: Record<string, any> = {};
    const ensure = (k: string) =>
      (groups[k] ||= {
        name: k,
        total: 0,
        pending: 0,
        inUse: 0,
        wasteStored: 0,
        closed: 0,
        rejected: 0,
        openAnomalies: 0,
        wasteStoredAmount: 0,
        wasteTransferredAmount: 0,
        closureRate: 0,
      });

    for (const r of reqs) {
      for (const k of keyOf(r)) {
        const g = ensure(k);
        g.total += 1;
        if ([ReqStatus.PENDING_ADVISOR, ReqStatus.PENDING_SAFETY, ReqStatus.APPROVED].includes(r.status as ReqStatus)) g.pending += 1;
        if ([ReqStatus.IN_USE, ReqStatus.USAGE_LOGGED].includes(r.status as ReqStatus)) g.inUse += 1;
        if (r.status === ReqStatus.WASTE_STORED) g.wasteStored += 1;
        if (r.status === ReqStatus.CLOSED) g.closed += 1;
        if ([ReqStatus.REJECTED, ReqStatus.CANCELLED].includes(r.status as ReqStatus)) g.rejected += 1;
        if (anomalies.some((a) => a.requisitionId === r.id)) g.openAnomalies += 1;
      }
    }
    for (const w of waste) {
      const req = reqs.find((r) => r.id === w.requisitionId);
      if (!req) continue;
      for (const k of keyOf(req)) {
        const g = ensure(k);
        if (w.status === WasteStatus.TRANSFERRED) g.wasteTransferredAmount += w.amount;
        else g.wasteStoredAmount += w.amount;
      }
    }
    return Object.values(groups)
      .map((g) => ({ ...g, closureRate: g.total ? Math.round((g.closed / g.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Requisition, Anomaly, WasteBarrel, WasteRecord, TransferManifest, DispenseRecord])],
  controllers: [DashboardController],
})
export class DashboardModule {}
