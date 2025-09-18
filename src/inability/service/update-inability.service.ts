import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getColombianDateTime, getColombianTimeString } from 'src/common/utils/dateColombia';

@Injectable()
export class UpdateInabilityService {
  private readonly logger = new Logger(UpdateInabilityService.name);

  constructor(private prisma: PrismaService) {}

  async updateWorkersWithExpiredInabilities() {
    const now = getColombianDateTime();
    const today = now.toISOString().split('T')[0];
    const currentTime = getColombianTimeString();

    // Buscar incapacidades cuyo fin ya pasó
    const expiredInabilities = await this.prisma.inability.findMany({
      where: {
        OR: [
          { dateDisableEnd: { lt: new Date(today) } },
          {
            dateDisableEnd: new Date(today),
          },
        ],
      },
      select: { id_worker: true },
    });

    const workerIds = expiredInabilities.map(i => i.id_worker);

    if (workerIds.length > 0) {
      await this.prisma.worker.updateMany({
        where: { id: { in: workerIds }, status: 'DISABLE' },
        data: { status: 'AVALIABLE',
          dateDisableStart: null,
          dateDisableEnd: null,
         },
      });
      this.logger.log(`Actualizados ${workerIds.length} trabajadores a AVALIABLE por incapacidades vencidas`);
    }
  }
}