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


    /**
   * Actualiza el estado de los trabajadores cuyo permiso inicia hoy
   */
  async updateWorkersWithStartingPermissions() {
    const now = getColombianDateTime();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Busca permisos que inician hoy
    const startingPermissions = await this.prisma.permission.findMany({
      where: {
        dateDisableStart: new Date(today),
      },
      select: { id_worker: true },
    });

    const workerIds = startingPermissions.map(p => p.id_worker);

    if (workerIds.length > 0) {
      await this.prisma.worker.updateMany({
        where: { id: { in: workerIds } },
        data: { status: 'PERMISSION' },
      });
      this.logger.log(`Actualizados ${workerIds.length} trabajadores a PERMISSION por permisos que inician hoy`);
    }
  }

  
    /**
   * Actualiza el estado de los trabajadores cuyo permiso vence hoy y la hora ya pasó o es igual
   */

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