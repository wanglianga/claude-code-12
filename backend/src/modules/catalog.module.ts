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
import { Like, Repository } from 'typeorm';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FumeHood, ReagentCatalog, Warehouse } from '../common/entities';
import { Roles } from '../common/auth';
import { DANGER_CATEGORIES, Role } from '../common/enums';

class CatalogDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  casNo?: string;

  @IsArray()
  dangerCategories: string[];

  @IsOptional()
  @IsString()
  storageCondition?: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSingleAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

class HoodStatusDto {
  @IsIn(['正常', '故障'])
  status: string;
}

@Controller()
export class CatalogController {
  constructor(
    @InjectRepository(ReagentCatalog) private catalog: Repository<ReagentCatalog>,
    @InjectRepository(Warehouse) private warehouses: Repository<Warehouse>,
    @InjectRepository(FumeHood) private hoods: Repository<FumeHood>,
  ) {}

  // ---- 试剂目录 ----
  @Get('catalog')
  list(@Query('keyword') keyword?: string) {
    const where = keyword ? [{ name: Like(`%${keyword}%`) }, { casNo: Like(`%${keyword}%`) }] : {};
    return this.catalog.find({ where, order: { name: 'ASC' } });
  }

  @Post('catalog')
  @Roles(Role.ADMIN)
  async create(@Body() dto: CatalogDto) {
    for (const c of dto.dangerCategories || []) {
      if (!(DANGER_CATEGORIES as readonly string[]).includes(c)) {
        throw new BadRequestException(`未知危险类别: ${c}`);
      }
    }
    const exists = await this.catalog.findOne({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('该试剂已存在于目录');
    return this.catalog.save(this.catalog.create(dto));
  }

  @Patch('catalog/:id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: CatalogDto) {
    const item = await this.catalog.findOne({ where: { id } });
    if (!item) throw new NotFoundException('试剂不存在');
    Object.assign(item, dto);
    return this.catalog.save(item);
  }

  // ---- 库房 ----
  @Get('warehouses')
  warehouseList() {
    return this.warehouses.find({ order: { name: 'ASC' } });
  }

  // ---- 通风橱 ----
  @Get('fume-hoods')
  hoodList() {
    return this.hoods.find({ order: { code: 'ASC' } });
  }

  @Patch('fume-hoods/:id/status')
  @Roles(Role.SAFETY, Role.KEEPER, Role.ADMIN)
  async setHoodStatus(@Param('id') id: string, @Body() dto: HoodStatusDto) {
    const hood = await this.hoods.findOne({ where: { id } });
    if (!hood) throw new NotFoundException('通风橱不存在');
    hood.status = dto.status;
    return this.hoods.save(hood);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ReagentCatalog, Warehouse, FumeHood])],
  controllers: [CatalogController],
})
export class CatalogModule {}
