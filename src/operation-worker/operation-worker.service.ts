// src/operation-worker/operation-worker.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/validation/validation.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { RemoveWorkersDto } from './dto/remove-workers.dto';
import { WorkerScheduleDto } from './dto/worker-schedule.dto';
import { v4 as uuidv4 } from 'uuid';
import {
  getColombianDateTime,
  getColombianTimeString,
} from 'src/common/utils/dateColombia';
import { StatusComplete } from '@prisma/client';

@Injectable()
export class OperationWorkerService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
  ) {}
  /**
   * Encuentra la programación de un trabajador específico en una operación
   * @param operationId - ID de la operación
   * @param workerId - ID del trabajador
   * @returns Registros de programación o array vacío si no existen
   */
  async findWorkerSchedule(operationId: number, workerId: number[]) {
    return await this.prisma.operation_Worker.findMany({
      where: {
        id_operation: operationId,
        id_worker: {
          in: workerId,
        },
      },
    });
  }

  /**
   * Asigna trabajadores a una operación
   * @param assignWorkersDto - Datos de asignación
   * @returns Resultado de la operación
   */
  async assignWorkersToOperation(
    assignWorkersDto: AssignWorkersDto,
    id_subsite?: number | null,
    id_site?: number | null,
  ) {
    try {
      const {
        id_operation,
        workerIds = [],
        workersWithSchedule = [],
      } = assignWorkersDto;

      // Si no hay trabajadores para asignar (ni simples ni con programación)
      if (workerIds.length === 0 && workersWithSchedule.length === 0) {
        return { message: 'No workers to assign', assignedWorkers: [] };
      }

      // 1. Recopilar todos los IDs de trabajadores para validación
      const allSimpleWorkerIds = [...workerIds];

      // Extraer todos los IDs de trabajadores de los grupos
      const allScheduledWorkerIds: number[] = [];
      workersWithSchedule.forEach((group) => {
        if (group.workerIds && Array.isArray(group.workerIds)) {
          allScheduledWorkerIds.push(...group.workerIds);
        }
      });

      // Combinar todos los IDs para validación
      const allWorkerIds = [...allSimpleWorkerIds, ...allScheduledWorkerIds];

      // Validar que todos los trabajadores existen
      if (allWorkerIds.length > 0) {
        const workerValidation = await this.validationService.validateAllIds({
          workerIds: allWorkerIds,
        });

        const validateWorkerIds =
          await this.validationService.validateWorkerIds(
            allWorkerIds,
            id_subsite,
            id_site,
          );
        if (validateWorkerIds?.status === 403) {
          return validateWorkerIds;
        }

        if (
          workerValidation &&
          'status' in workerValidation &&
          workerValidation.status === 404
        ) {
          return workerValidation;
        }
      }

      // 3. Obtener trabajadores ya asignados
      const currentWorkers = await this.prisma.operation_Worker.findMany({
        where: { id_operation },
        select: { id_worker: true },
      });

      const currentWorkerIds = currentWorkers.map((worker) => worker.id_worker);

      // 4. Filtrar los trabajadores que ya están asignados
      const simplesToAdd = allSimpleWorkerIds.filter(
        (id) => !currentWorkerIds.includes(id),
      );

      // Para los trabajadores programados, necesitamos filtrar por grupo
      const scheduledGroupsToProcess: typeof workersWithSchedule = [];

      workersWithSchedule.forEach((group) => {
        // Filtrar solo los IDs de trabajadores que no están asignados aún
        const filteredIds = group.workerIds.filter(
          (id) => !currentWorkerIds.includes(id),
        );

        if (filteredIds.length > 0) {
          // Crear una copia del grupo con solo los trabajadores no asignados
          scheduledGroupsToProcess.push({
            ...group,
            workerIds: filteredIds,
          });
        }
      });

      // Verificar si hay trabajadores nuevos para asignar
      if (simplesToAdd.length === 0 && scheduledGroupsToProcess.length === 0) {
        return { message: 'No new workers to assign', assignedWorkers: [] };
      }

      // 5. Crear registros para trabajadores
      const assignmentPromises: Promise<any>[] = [];

      // Función para convertir fechas
      const parseDate = (dateString) => {
        if (!dateString) return null;
        return new Date(dateString);
      };

      // Asignar trabajadores simples (sin programación)
      if (simplesToAdd.length > 0) {
        const simpleAssignments = simplesToAdd.map((workerId) =>
          this.prisma.operation_Worker.create({
            data: {
              id_operation,
              id_worker: workerId,
              dateStart: null,
              dateEnd: null,
              timeStart: null,
              timeEnd: null,
            },
          }),
        );
        assignmentPromises.push(...simpleAssignments);
      }

      // Asignar grupos de trabajadores con la misma programación
      if (scheduledGroupsToProcess.length > 0) {
        // Para cada grupo de trabajadores con programación
        scheduledGroupsToProcess.forEach((group) => {
          const groupId = group.id_group || uuidv4(); // Generar un ID único si no se proporciona
          const groupSchedule = {
            dateStart: group.dateStart ? parseDate(group.dateStart) : null,
            dateEnd: group.dateEnd ? parseDate(group.dateEnd) : null,
            timeStart: group.timeStart || null,
            timeEnd: group.timeEnd || null,
            id_group: groupId,
            id_task: group.id_task || null,
            id_subtask: group.id_subtask || null,
          };

          // Crear una promesa de creación para cada trabajador en el grupo
          const groupAssignments = group.workerIds.map((workerId) =>
            this.prisma.operation_Worker.create({
              data: {
                id_operation,
                id_worker: workerId,
                ...groupSchedule,
              },
            }),
          );

          assignmentPromises.push(...groupAssignments);
        });
      }

      // Ejecutar todas las asignaciones
      await Promise.all(assignmentPromises);

      // 6. Actualizar estado de los trabajadores asignados
      const allWorkersToUpdate = [
        ...simplesToAdd,
        ...scheduledGroupsToProcess.flatMap((g) => g.workerIds),
      ];

      if (allWorkersToUpdate.length > 0) {
        await this.prisma.worker.updateMany({
          where: { id: { in: allWorkersToUpdate } },
          data: { status: 'ASSIGNED' },
        });
      }

      // 7. Generar respuesta
      return {
        message: `${allWorkersToUpdate.length} workers assigned to operation ${id_operation}`,
        assignedWorkers: {
          simple: simplesToAdd,
          scheduled: scheduledGroupsToProcess,
        },
      };
    } catch (error) {
      console.error('Error assigning workers to operation:', error);
      throw new Error(error.message);
    }
  }
  /**
   * Cambiar estado de programacion cliente a COMPLETED
   * @param id_clientProgramming - ID de la programación del cliente
   * @returns Resultado de la actualización
   */
  async completeClientProgramming(id: number) {
    try {
      // Validar que la programación del cliente existe para extraer el ID clientProgramming
      const clientProgramming = await this.prisma.operation.findUnique({
        where: { id },
      });
      if (!clientProgramming) {
        return { message: 'Client programming not found', status: 404 };
      }
      const id_clientProgramming = clientProgramming.id_clientProgramming;

      if (id_clientProgramming === null) {
        return {
          message: 'Operation has no associated client programming',
          status: 400,
        };
      }

      const updateResult = await this.prisma.clientProgramming.update({
        where: { id: id_clientProgramming },
        data: {
          status: StatusComplete.COMPLETED,
        },
      });
      return updateResult;
    } catch (error) {
      console.error('Error completing client programming:', error);
      throw new Error(error.message);
    }
  }
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
  /**
   * Obtiene todos los trabajadores asignados a una operación
   * @param id_operation - ID de la operación
   * @returns Lista de trabajadores asignados
   */
  async getWorkersFromOperation(id_operation: number) {
    try {
      // Verificar que la operación existe
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
      });

      if (!operation) {
        return { message: 'Operation not found', status: 404 };
      }

      // Obtener los trabajadores con detalles
      const operationWorkers = await this.prisma.operation_Worker.findMany({
        where: { id_operation },
        select: {
          worker: {
            select: {
              id: true,
              name: true,
              dni: true,
              status: true,
              phone: true,
            },
          },
        },
      });

      const workers = operationWorkers.map((ow) => ow.worker);

      return workers;
    } catch (error) {
      console.error('Error getting workers from operation:', error);
      throw new Error(error.message);
    }
  }
  /**
   * Actualiza la programación de trabajadores ya asignados a una operación
   * @param id_operation ID de la operación
   * @param workersToUpdate Array de trabajadores con su nueva programación
   * @returns Resultado de la actualización
   */
  async updateWorkersSchedule(
    id_operation: number,
    workersToUpdate: WorkerScheduleDto[],
  ) {
    try {
      // Verificar que la operación existe
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
      });

      if (!operation) {
        return { message: 'Operation not found', status: 404 };
      }

      const taskSubTaskRelations: { id_task: number; id_subtask: number }[] =
        [];

      for (const worker of workersToUpdate || []) {
        if (worker.id_task && worker.id_subtask) {
          taskSubTaskRelations.push({
            id_task: worker.id_task,
            id_subtask: worker.id_subtask,
          });
        }
      }

      // Solo validar si hay relaciones task-subtask
      if (taskSubTaskRelations.length > 0) {
       
        const validationResult =
          await this.validationService.validateTaskSubTaskRelations(
            taskSubTaskRelations,
          );

        if (validationResult.status === 400) {
          return validationResult;
        }
      }
      // Contadores para el reporte final
      let groupsUpdated = 0;
      let totalWorkersUpdated = 0;

      // Por cada grupo de trabajadores a actualizar
      for (const group of workersToUpdate) {
        const {
          dateStart,
          timeStart,
          dateEnd,
          timeEnd,
          id_group,
          workerIds,
          id_subtask,
          id_task,
        } = group;

        // VALIDACIÓN CRÍTICA: Verificar que el id_group existe en la operación
        if (!id_group) {
          throw new Error(
            'id_group es requerido para actualizar un grupo existente',
          );
        }

        // Verificar que el grupo existe en la operación
        const existingGroupRecords =
          await this.prisma.operation_Worker.findMany({
            where: {
              id_operation,
              id_group: id_group,
            },
          });

        if (existingGroupRecords.length === 0) {
          return {
            message: `Group with id_group ${id_group} not found in operation ${id_operation}`,
            status: 404,
          };
        }

        // NUEVO: Agregar trabajadores si se proporcionaron workerIds
        if (workerIds && workerIds.length > 0) {
          // Obtener trabajadores actuales del grupo
          const currentWorkerIds = existingGroupRecords.map(
            (record) => record.id_worker,
          );

          // Filtrar trabajadores nuevos (que no están en el grupo)
          const newWorkerIds = workerIds.filter(
            (id) => !currentWorkerIds.includes(id),
          );

          if (newWorkerIds.length > 0) {
            // Validar que los trabajadores existen
            const validation = await this.validationService.validateAllIds({
              workerIds: newWorkerIds,
            });
            if (
              validation &&
              'status' in validation &&
              validation.status === 404
            ) {
              return validation;
            }

            // Obtener configuración del primer registro del grupo para aplicar a los nuevos
            const groupConfig = existingGroupRecords[0];

            // Crear registros para los nuevos trabajadores
            const newWorkerRecords = newWorkerIds.map((workerId) => ({
              id_operation,
              id_worker: workerId,
              id_group: id_group,
              dateStart: groupConfig.dateStart,
              dateEnd: groupConfig.dateEnd,
              timeStart: groupConfig.timeStart,
              timeEnd: groupConfig.timeEnd,
              id_task: groupConfig.id_task,
              id_subtask: groupConfig.id_subtask,
            }));

            await this.prisma.operation_Worker.createMany({
              data: newWorkerRecords,
            });

            // Actualizar estado de trabajadores a ASSIGNED
            await this.prisma.worker.updateMany({
              where: { id: { in: newWorkerIds } },
              data: { status: 'ASSIGNED' },
            });

            console.log(
              `Added ${newWorkerIds.length} new workers to group ${id_group}`,
            );
          }
        }

        const updateData: any = {};

        // Solo incluir campos que se proporcionaron (evitar sobrescribir con undefined)
        if (dateStart !== undefined) {
          updateData.dateStart = dateStart ? new Date(dateStart) : null;
        }

        if (timeStart !== undefined) {
          updateData.timeStart = timeStart || null;
        }

        if (dateEnd !== undefined) {
          updateData.dateEnd = dateEnd ? new Date(dateEnd) : null;
        }

        if (timeEnd !== undefined) {
          updateData.timeEnd = timeEnd || null;
        }

        if (id_subtask !== undefined) {
          updateData.id_subtask = id_subtask || null;
        }

        if (id_task !== undefined) {
          updateData.id_task = id_task || null;
        }

        // Ejecutar la actualización del grupo completo (incluye los nuevos trabajadores)
        const updateResult = await this.prisma.operation_Worker.updateMany({
          where: {
            id_operation,
            id_group: id_group,
          },
          data: updateData,
        });

        groupsUpdated++;
        totalWorkersUpdated += updateResult.count;
      }

      return {
        message: `Workers schedule updated successfully: ${groupsUpdated} groups updated, ${totalWorkersUpdated} workers affected`,
        groupsUpdated,
        totalWorkersUpdated,
      };
    } catch (error) {
      console.error('Error updating workers schedule:', error);
      throw new Error(error.message);
    }
  }
}
