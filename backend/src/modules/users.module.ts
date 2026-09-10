import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { TrainingRecord, User } from '../common/entities';
import { CurrentUser, Roles } from '../common/auth';
import { Role } from '../common/enums';

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(Object.values(Role))
  role: string;

  @IsOptional()
  @IsString()
  college?: string;

  @IsOptional()
  @IsString()
  researchGroup?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(Object.values(Role))
  role?: string;

  @IsOptional()
  @IsString()
  college?: string;

  @IsOptional()
  @IsString()
  researchGroup?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

class CreateTrainingDto {
  @IsString()
  @IsNotEmpty()
  courseName: string;

  @IsString()
  @IsNotEmpty()
  passedAt: string;

  @IsString()
  @IsNotEmpty()
  validUntil: string;

  @IsOptional()
  @IsString()
  certificateNo?: string;
}

function safeUser(u: User) {
  if (!u) return u;
  const { passwordHash, ...rest } = u;
  return rest;
}

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(TrainingRecord) private trainings: Repository<TrainingRecord>,
  ) {}

  // 学生填单时选择导师
  @Get('advisors')
  async advisors() {
    const list = await this.users.find({ where: { role: Role.ADVISOR } });
    return list.map(safeUser);
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(@Query('role') role?: string) {
    const where = role ? { role } : {};
    const list = await this.users.find({ where, order: { createdAt: 'ASC' } });
    return list.map(safeUser);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateUserDto) {
    const exists = await this.users.findOne({ where: { username: dto.username } });
    if (exists) throw new BadRequestException('用户名已存在');
    const user = this.users.create({
      username: dto.username,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      name: dto.name,
      role: dto.role,
      college: dto.college || null,
      researchGroup: dto.researchGroup || null,
      phone: dto.phone || null,
    });
    return safeUser(await this.users.save(user));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.college !== undefined) user.college = dto.college;
    if (dto.researchGroup !== undefined) user.researchGroup = dto.researchGroup;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.password) user.passwordHash = bcrypt.hashSync(dto.password, 10);
    return safeUser(await this.users.save(user));
  }

  @Get(':id/trainings')
  async trainingList(@Param('id') id: string, @CurrentUser() me: any) {
    if (![Role.ADMIN, Role.SAFETY].includes(me.role) && me.sub !== id) {
      throw new ForbiddenException('无权查看他人培训记录');
    }
    return this.trainings.find({ where: { userId: id }, order: { validUntil: 'DESC' } });
  }

  @Post(':id/trainings')
  @Roles(Role.ADMIN, Role.SAFETY)
  async addTraining(@Param('id') id: string, @Body() dto: CreateTrainingDto) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    return this.trainings.save(this.trainings.create({ userId: id, ...dto }));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User, TrainingRecord])],
  controllers: [UsersController],
})
export class UsersModule {}
