import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  getColombianDateTime,
  getColombianTimeString,
  getColombianStartOfDay,
  getColombianEndOfDay,
} from 'src/common/utils/dateColombia';


@Injectable()
export class UpdatePermissionService {
  private readonly logger = new Logger(UpdatePermissionService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  async updateWorkersWithExpiredPermissions() {
    const now = getColombianDateTime();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = getColombianTimeString(); // HH:MM

    // Solo actualizar si la fecha es hoy y la hora ya pasó o es igual
    const expiredPermissions = await this.prisma.permission.findMany({
      where: {
        dateDisableEnd: new Date(today),
        timeEnd: { lte: currentTime },
      },
      select: { id_worker: true },
    });

    const workerIds = expiredPermissions.map(p => p.id_worker);

    if (workerIds.length > 0) {
      await this.prisma.worker.updateMany({
        where: { id: { in: workerIds }, status: 'PERMISSION' },
        data: {
          status: 'AVALIABLE',
          dateDisableStart: null,
          dateDisableEnd: null,
        },
      });
      this.logger.log(`Actualizados ${workerIds.length} trabajadores a AVALIABLE por permisos vencidos (fecha y hora cumplidas)`);
    }
  }
}