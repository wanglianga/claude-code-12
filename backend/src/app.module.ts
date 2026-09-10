import { Module, Controller, Get } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth.module';
import { UsersModule } from './modules/users.module';
import { CatalogModule } from './modules/catalog.module';
import { InventoryModule } from './modules/inventory.module';
import { RequisitionsModule } from './modules/requisitions.module';
import { WasteModule } from './modules/waste.module';
import { AnomaliesModule } from './modules/anomalies.module';
import { DashboardModule } from './modules/dashboard.module';
import { SeedModule } from './seed/seed.module';
import { Public } from './common/auth';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'labuser',
      password: process.env.DB_PASSWORD || 'labpass',
      database: process.env.DB_NAME || 'labreagent',
      autoLoadEntities: true,
      synchronize: true, // 0-1 演示工程：启动自动建表
    }),
    AuthModule,
    UsersModule,
    CatalogModule,
    InventoryModule,
    RequisitionsModule,
    WasteModule,
    AnomaliesModule,
    DashboardModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
