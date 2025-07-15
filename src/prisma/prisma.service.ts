
import { Injectable, OnModuleInit, OnModuleDestroy} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
/**
 * Servicio para gestionar la conexion con la base de datos
 * @class PrismaService
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy  {
  async onModuleInit() {
    await this.$connect();
  }
    async onModuleDestroy() {
    await this.$disconnect();
  }
}
