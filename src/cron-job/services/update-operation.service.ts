import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { differenceInMinutes } from 'date-fns';
import {
  getColombianDateTime,
  getColombianTimeString,
  getColombianStartOfDay,
  getColombianEndOfDay,
} from 'src/common/utils/dateColombia';
import { BillService } from 'src/bill/bill.service';

@Injectable()
export class UpdateOperationService {
  private readonly logger = new Logger(UpdateOperationService.name);

  constructor(
    private prisma: PrismaService,
    private billService: BillService,
  ) {}

  /**
   * Actualiza las operaciones de estado PENDING a INPROGRESS cuando hayan pasado 5 minutos
   * desde la hora de inicio programada.
   */
  async updateInProgressOperations() {
    try {
      this.logger.debug('Checking for operations to update to INPROGRESS...');

      // Usar hora colombiana en lugar de hora del servidor
      const now = getColombianDateTime();

      // Crear fecha de inicio (hoy a medianoche hora colombiana)
      const startOfDay = getColombianStartOfDay(now);

      // Crear fecha de fin (mañana a medianoche hora colombiana)
      const endOfDay = getColombianEndOfDay(now);

      this.logger.debug(`Colombian time now: ${now.toISOString()}`);
      this.logger.debug(
        `Searching operations for date: ${startOfDay.toISOString()}`,
      );

      // Buscar todas las operaciones con estado PENDING para hoy
      const pendingOperations = await this.prisma.operation.findMany({
        where: {
          dateStart: {
            gte: startOfDay, // Mayor o igual que hoy a medianoche (hora colombiana)
            lt: endOfDay, // Menor que mañana a medianoche (hora colombiana)
          },
          status: 'PENDING',
        },
      });

      this.logger.debug(`Found ${pendingOperations.length} pending operations`);

      let updatedCount = 0;

      for (const operation of pendingOperations) {
        // Crear la fecha de inicio completa combinando dateStart y timeStrat
        const dateStartStr = operation.dateStart.toISOString().split('T')[0];
        const startDateTime = new Date(
          `${dateStartStr}T${operation.timeStrat}`,
        );

        // Verificar si han pasado 5 minutos desde la hora de inicio (usando hora colombiana)
        const minutesDiff = differenceInMinutes(now, startDateTime);
        this.logger.debug(
          `Operation ${operation.id}: ${minutesDiff} minutes since start time (Colombian time)`,
        );

        if (minutesDiff >= 5) {
          // Actualizar el estado a INPROGRESS
          await this.prisma.operation.update({
            where: { id: operation.id },
            data: { status: 'INPROGRESS' },
          });

          // Actualizar la fecha y hora de inicio en la tabla intermedia (con hora colombiana)
          await this.prisma.operation_Worker.updateMany({
            where: {
              id_operation: operation.id,
              dateEnd: null,
              timeEnd: null,
            },
            data: {
              dateStart: operation.dateStart,
              timeStart: operation.timeStrat,
            },
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        this.logger.debug(
          `Updated ${updatedCount} operations to INPROGRESS status`,
        );
      }

      return { updatedCount };
    } catch (error) {
      this.logger.error('Error updating operations:', error);
      throw error;
    }
  }

  async updateCompletedOperations() {
    try {
      this.logger.debug('Checking for operations to update to COMPLETED...');

      // Usar hora colombiana en lugar de hora del servidor
      const now = getColombianDateTime();

      // Crear fecha de inicio (hoy a medianoche hora colombiana)
      const startOfDay = getColombianStartOfDay(now);

      // Crear fecha de fin (mañana a medianoche hora colombiana)
      const endOfDay = getColombianEndOfDay(now);

      this.logger.debug(`Colombian time now: ${now.toISOString()}`);
      this.logger.debug(
        `Searching operations for date: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`,
      );

      // Buscar todas las operaciones con estado INPROGRESS para hoy que tengan fecha de finalización
      const inProgressOperations = await this.prisma.operation.findMany({
        where: {
          dateEnd: {
            gte: startOfDay, // Mayor o igual que hoy a medianoche (hora colombiana)
            lt: endOfDay, // Menor que mañana a medianoche (hora colombiana)
          },
          status: 'INPROGRESS',
          timeEnd: {
            not: null, // Asegurarse de que tienen una hora de finalización
          },
        },
      });

      this.logger.debug(
        `Found ${inProgressOperations.length} in-progress operations with end time`,
      );

      let updatedCount = 0;
      let releasedWorkersCount = 0;
      let billsCreatedCount = 0;

      for (const operation of inProgressOperations) {
        // Verificar que tenemos todos los datos necesarios
        if (!operation.dateEnd || !operation.timeEnd) {
          this.logger.warn(
            `Operation ${operation.id} has missing end date or time`,
          );
          continue;
        }

        // Crear la fecha de finalización completa combinando dateEnd y timeEnd
        const dateEndStr = operation.dateEnd.toISOString().split('T')[0];
        const endDateTime = new Date(`${dateEndStr}T${operation.timeEnd}`);

        // Verificar si han pasado 10 minutos desde la hora de finalización (usando hora colombiana)
        const minutesDiff = differenceInMinutes(now, endDateTime);
        this.logger.debug(
          `Operation ${operation.id}: ${minutesDiff} minutes since end time (Colombian time)`,
        );

        // Si han pasado 10 minutos desde la hora de finalización
        if (minutesDiff >= 10) {
          // Obtener fecha y hora de finalización en zona horaria colombiana
          const colombianEndTime = getColombianDateTime();
          const colombianTimeString = getColombianTimeString();

          // Paso 1: Obtener los trabajadores de esta operación desde la tabla intermedia
          const operationWorkers = await this.prisma.operation_Worker.findMany({
            where: { id_operation: operation.id },
            select: { id_worker: true, id_group: true },
          });

          const workerIds = operationWorkers.map((ow) => ow.id_worker);
          this.logger.debug(
            `Found ${workerIds.length} workers for operation ${operation.id}`,
          );

          // Paso 2: Actualizar el estado de los trabajadores a AVALIABLE
          if (workerIds.length > 0) {
            const result = await this.prisma.worker.updateMany({
              where: {
                id: { in: workerIds },
                status: { not: 'AVALIABLE' },
              },
              data: { status: 'AVALIABLE' },
            });

            releasedWorkersCount += result.count;
            this.logger.debug(
              `Released ${result.count} workers from operation ${operation.id}`,
            );
          }

          // Paso 3: Actualizar el estado de la operación a COMPLETED
          const response = await this.prisma.operation.update({
            where: { id: operation.id },
            data: { status: 'COMPLETED' },
          });

          // Paso 4: Crear factura en ceros automáticamente
          try {
            // Obtener grupos únicos de la operación
            const uniqueGroups = [
              ...new Set(operationWorkers.map((ow) => ow.id_group)),
            ];

            // Crear grupos para la factura en ceros
            const billGroups = uniqueGroups
              // .filter((groupId) => groupId !== null) // filtra los null
              .map((groupId) => ({
                id: String(groupId),
                amount: 0,
                group_hours: 0,
                pays: operationWorkers
                  .filter((ow) => ow.id_group === groupId)
                  .map((ow) => ({
                    id_worker: ow.id_worker,
                    pay: 0,
                  })),
                paysheetHoursDistribution: {
                  HOD: 0,
                  HON: 0,
                  HED: 0,
                  HEN: 0,
                  HFOD: 0,
                  HFON: 0,
                  HFED: 0,
                  HFEN: 0,
                },
                billHoursDistribution: {
                  HOD: 0,
                  HON: 0,
                  HED: 0,
                  HEN: 0,
                  HFOD: 0,
                  HFON: 0,
                  HFED: 0,
                  HFEN: 0,
                },
              }));

            const createBillDto = {
              id_operation: operation.id,
              groups: billGroups,
            };

            // Llamar al servicio de facturación (userId 1 para sistema automático)
            await this.billService.create(createBillDto, 1);

            billsCreatedCount++;
            this.logger.debug(
              `Factura en ceros creada automáticamente para operación ${operation.id}`,
            );
          } catch (billError) {
            this.logger.error(
              `Error creando factura en ceros para operación ${operation.id}:`,
              billError,
            );
            // No interrumpir el proceso por error en facturación
          }

          // Paso 4: Actualizar la fecha y hora de finalización en la tabla intermedia (con hora colombiana)
          await this.prisma.operation_Worker.updateMany({
            where: {
              id_operation: operation.id,
              dateEnd: null,
              timeEnd: null,
            },
            data: {
              dateEnd: colombianEndTime, // Usar hora colombiana
              timeEnd: colombianTimeString, // Usar hora colombiana en formato HH:MM
            },
          });

          //paso 5: actulizar el estado de cliente programming a COMPLETED
          if (response.id_clientProgramming) {
            await this.prisma.clientProgramming.update({
              where: { id: response.id_clientProgramming },
              data: { status: 'COMPLETED' },
            });
            this.logger.debug(
              `Updated client programming ${response.id_clientProgramming} to COMPLETED status`,
            );
          }

          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        this.logger.debug(
          `Updated ${updatedCount} operations to COMPLETED status`,
        );
      }

      return { updatedCount,
        billsCreatedCount,
        releasedWorkersCount
       };
    } catch (error) {
      this.logger.error('Error updating completed operations:', error);
      throw error;
    }
  }
}
