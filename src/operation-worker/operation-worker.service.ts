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
  async assignWorkersToOperation(assignWorkersDto: AssignWorkersDto) {
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
  async removeWorkersFromOperation(removeWorkersDto: RemoveWorkersDto) {
    try {
      const { id_operation, workerIds } = removeWorkersDto;
      // Validar que todos los trabajadores existen
      if (workerIds && workerIds.length > 0) {
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

        // Eliminar solo las relaciones especificadas
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

      // Contadores para el reporte final
      let groupsUpdated = 0;
      let totalWorkersUpdated = 0;

      // Por cada grupo de trabajadores a actualizar
      for (const group of workersToUpdate) {
        const { dateStart, timeStart, dateEnd, timeEnd, id_group } = group;

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
          throw new Error(
            `El grupo ${id_group} no existe en la operación ${id_operation}`,
          );
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

        // Ejecutar la actualización del grupo completo
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
