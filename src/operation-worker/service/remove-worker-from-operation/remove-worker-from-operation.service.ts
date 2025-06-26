import { Injectable } from '@nestjs/common';
import { getColombianDateTime, getColombianTimeString } from 'src/common/utils/dateColombia';
import { ValidationService } from 'src/common/validation/validation.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RemoveWorkerFromOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Remueve trabajadores de una operación
   * @param removeWorkersDto - Datos de remoción
   * @returns Resultado de la operación
   */
  async removeWorkersFromOperation(removeWorkersDto: any) {
    try {
      const { id_operation, workerIds, workersToRemove } = removeWorkersDto;

      // CASO 1: Formato original (compatibilidad hacia atrás)
      if (workerIds && workerIds.length > 0) {
        // Validar que todos los trabajadores existen
        const workerValidation = await this.validationService.validateAllIds({
          workerIds,
        });

        if (
          workerValidation &&
          'status' in workerValidation &&
          workerValidation.status === 404
        ) {
          return workerValidation;
        }

        // Eliminar de toda la operación (comportamiento original)
        await this.prisma.operation_Worker.deleteMany({
          where: {
            id_operation,
            id_worker: { in: workerIds },
          },
        });

        // Actualizar estado de los trabajadores eliminados
        await this.prisma.worker.updateMany({
          where: { id: { in: workerIds } },
          data: { status: 'AVALIABLE' },
        });

        return {
          message: `${workerIds.length} workers removed from operation ${id_operation}`,
          removedWorkers: workerIds,
        };
      }

      // CASO 2: Nuevo formato con id_group opcional
      if (workersToRemove && workersToRemove.length > 0) {
        const results: Array<{
          workerId: any;
          groupId?: any;
          action: string;
          success: boolean;
          workerReleased?: boolean;
          groupsRemoved?: number;
        }> = [];
        const allWorkerIds = workersToRemove.map((w) => w.id);

        // Validar que todos los trabajadores existen
        const workerValidation = await this.validationService.validateAllIds({
          workerIds: allWorkerIds,
        });

        if (
          workerValidation &&
          'status' in workerValidation &&
          workerValidation.status === 404
        ) {
          return workerValidation;
        }

        for (const workerToRemove of workersToRemove) {
          const { id: workerId, id_group } = workerToRemove;

          if (id_group) {
            // Eliminar solo del grupo específico
            const deleteResult = await this.prisma.operation_Worker.deleteMany({
              where: {
                id_operation,
                id_worker: workerId,
                id_group: id_group,
              },
            });

            if (deleteResult.count > 0) {
              results.push({
                workerId,
                groupId: id_group,
                action: 'removed_from_group',
                success: true,
              });

              // Verificar si el trabajador aún está en otros grupos de esta operación
              const remainingInOperation =
                await this.prisma.operation_Worker.findFirst({
                  where: {
                    id_operation,
                    id_worker: workerId,
                  },
                });

              // Solo liberar si no está en otros grupos de esta operación
              if (!remainingInOperation) {
                // Verificar si está en otras operaciones activas
                const inOtherActiveOps =
                  await this.prisma.operation_Worker.findFirst({
                    where: {
                      id_worker: workerId,
                      id_operation: { not: id_operation },
                      operation: {
                        status: { in: ['PENDING', 'INPROGRESS'] },
                      },
                    },
                  });

                if (!inOtherActiveOps) {
                  await this.prisma.worker.update({
                    where: { id: workerId },
                    data: { status: 'AVALIABLE' },
                  });
                  results[results.length - 1].workerReleased = true;
                }
              }
            } else {
              results.push({
                workerId,
                groupId: id_group,
                action: 'not_found_in_group',
                success: false,
              });
            }
          } else {
            // Eliminar de toda la operación
            const deleteResult = await this.prisma.operation_Worker.deleteMany({
              where: {
                id_operation,
                id_worker: workerId,
              },
            });

            if (deleteResult.count > 0) {
              results.push({
                workerId,
                action: 'removed_from_operation',
                groupsRemoved: deleteResult.count,
                success: true,
              });

              // Verificar si está en otras operaciones activas antes de liberar
              const inOtherActiveOps =
                await this.prisma.operation_Worker.findFirst({
                  where: {
                    id_worker: workerId,
                    id_operation: { not: id_operation },
                    operation: {
                      status: { in: ['PENDING', 'INPROGRESS'] },
                    },
                  },
                });

              if (!inOtherActiveOps) {
                await this.prisma.worker.update({
                  where: { id: workerId },
                  data: { status: 'AVALIABLE' },
                });
                results[results.length - 1].workerReleased = true;
              }
            } else {
              results.push({
                workerId,
                action: 'not_found_in_operation',
                success: false,
              });
            }
          }
        }

        return {
          message: `Processed ${workersToRemove.length} worker removal requests`,
          results,
        };
      }

      return { message: 'No workers to remove', removedWorkers: [] };
    } catch (error) {
      console.error('Error removing workers from operation:', error);
      throw new Error(error.message);
    }
  }

   /**
     *  Libera todos los trabajadores de una operación
     * @param id_operation
     * @returns Resultado de la liberación
     */
    async releaseAllWorkersFromOperation(id_operation: number) {
      try {
        // Obtener los trabajadores de esta operación
        const operationWorkers = await this.prisma.operation_Worker.findMany({
          where: { id_operation },
          select: { id_worker: true },
        });
  
        const workerIds = operationWorkers.map((ow) => ow.id_worker);
  
        if (workerIds.length === 0) {
          return {
            message: 'No workers assigned to this operation',
            releasedWorkers: [],
          };
        }
  
        // Verificar trabajadores en otras operaciones ACTIVAS (PENDING o INPROGRESS)
        const workersInActiveOperations =
          await this.prisma.operation_Worker.findMany({
            where: {
              id_worker: { in: workerIds },
              id_operation: { not: id_operation },
              operation: {
                status: { in: ['PENDING', 'INPROGRESS'] }, // Solo operaciones activas
              },
            },
            select: {
              id_worker: true,
              operation: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });
  
        const workerIdsInActiveOps = workersInActiveOperations.map(
          (w) => w.id_worker,
        );
        const workersToRelease = workerIds.filter(
          (id) => !workerIdsInActiveOps.includes(id),
        );
  
        // Liberar solo trabajadores que no están en operaciones activas
        if (workersToRelease.length > 0) {
          await this.prisma.worker.updateMany({
            where: {
              id: { in: workersToRelease },
              status: { not: 'AVALIABLE' },
            },
            data: { status: 'AVALIABLE' },
          });
        }
  
        // Actualizar fecha de finalización en la tabla intermedia
        await this.prisma.operation_Worker.updateMany({
          where: { id_operation, dateEnd: null, timeEnd: null },
          data: {
            dateEnd: getColombianDateTime(),
            timeEnd: getColombianTimeString(),
          },
        });
  
        return {
          message: `Operation ${id_operation} completed - ${workersToRelease.length} workers released`,
          releasedWorkers: workersToRelease,
        };
      } catch (error) {
        console.error('Error releasing workers from operation:', error);
        throw new Error(error.message);
      }
    }
}
