import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InventoryBatch, ReagentCatalog, Warehouse } from '../common/entities';
import { Roles } from '../common/auth';
import { Role, todayStr } from '../common/enums';

class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  reagentId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsNotEmpty()
  batchNo: string;

  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsString()
  @IsNotEmpty()
  expiryDate: string; // YYYY-MM-DD
}

class UpdateBatchDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingAmount?: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsIn(['在库', '用尽', '过期锁定'])
  status?: string;
}

@Controller('inventory')
export class InventoryController {
  constructor(
    @InjectRepository(InventoryBatch) private batches: Repository<InventoryBatch>,
    @InjectRepository(ReagentCatalog) private catalog: Repository<ReagentCatalog>,
    @InjectRepository(Warehouse) private warehouses: Repository<Warehouse>,
  ) {}

  @Get('batches')
  @Roles(Role.KEEPER, Role.SAFETY, Role.ADMIN)
  list(@Query('reagentId') reagentId?: string, @Query('warehouseId') warehouseId?: string) {
    const where: any = {};
    if (reagentId) where.reagentId = reagentId;
    if (warehouseId) where.warehouseId = warehouseId;
    return this.batches.find({ where, order: { expiryDate: 'ASC' } });
  }

  // 某试剂的有效库存（未过期批次合计），供安全员核查
  @Get('availability')
  async availability(@Query('reagentId') reagentId: string) {
    const batches = await this.batches.find({ where: { reagentId, status: '在库' } });
    const today = todayStr();
    const valid = batches.filter((b) => b.expiryDate >= today && b.remainingAmount > 0);
    return {
      available: valid.reduce((s, b) => s + b.remainingAmount, 0),
      batches: valid,
      expired: batches.filter((b) => b.expiryDate < today),
    };
  }

  @Post('batches')
  @Roles(Role.KEEPER, Role.ADMIN)
  async create(@Body() dto: CreateBatchDto) {
    const reagent = await this.catalog.findOne({ where: { id: dto.reagentId } });
    if (!reagent) throw new BadRequestException('试剂不存在');
    const warehouse = await this.warehouses.findOne({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new BadRequestException('库房不存在');
    const dup = await this.batches.findOne({ where: { batchNo: dto.batchNo } });
    if (dup) throw new BadRequestException('批号已存在');
    const batch = this.batches.create({
      reagentId: reagent.id,
      reagentName: reagent.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      batchNo: dto.batchNo,
      totalAmount: dto.totalAmount,
      remainingAmount: dto.totalAmount,
      unit: reagent.unit,
      expiryDate: dto.expiryDate,
      opened: false,
      status: '在库',
    });
    return this.batches.save(batch);
  }

  @Patch('batches/:id')
  @Roles(Role.KEEPER, Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    const batch = await this.batches.findOne({ where: { id } });
    if (!batch) throw new NotFoundException('批次不存在');
    if (dto.remainingAmount !== undefined) batch.remainingAmount = dto.remainingAmount;
    if (dto.expiryDate !== undefined) batch.expiryDate = dto.expiryDate;
    if (dto.status !== undefined) batch.status = dto.status;
    return this.batches.save(batch);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([InventoryBatch, ReagentCatalog, Warehouse])],
  controllers: [InventoryController],
})
export class InventoryModule {}
