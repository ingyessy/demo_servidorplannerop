// src/operation-worker/operation-worker.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/validation/validation.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { RemoveWorkersDto } from './dto/remove-workers.dto';

@Injectable()
export class OperationWorkerService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
  ) {}

  /**
   * Asigna trabajadores a una operación
   * @param assignWorkersDto - Datos de asignación
   * @returns Resultado de la operación
   */
  async assignWorkersToOperation(assignWorkersDto: AssignWorkersDto) {
    try {
      const {
        id_operation,
        workerIds,
        dateEnd,
        dateStart,
        timeEnd,
        timeStart,
      } = assignWorkersDto;

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

        // Obtener trabajadores que ya están asignados a esta operación
        const currentWorkers = await this.prisma.operation_Worker.findMany({
          where: { id_operation },
          select: { id_worker: true },
        });

        const currentWorkerIds = currentWorkers.map(
          (worker) => worker.id_worker,
        );

        // Filtrar para solo añadir trabajadores que no están ya asignados
        const workersToAdd = workerIds.filter(
          (workerId) => !currentWorkerIds.includes(workerId),
        );

        if (workersToAdd.length > 0) {
          // Crear nuevas relaciones solo para trabajadores no asignados previamente

          const baseData = {
            id_operation,
            dateStart: dateStart || undefined,
            dateEnd: dateEnd || undefined,
            timeStart: timeStart || undefined,
            timeEnd: timeEnd || undefined,
          }
          await Promise.all(
            workersToAdd.map(workerId => 
              this.prisma.operation_Worker.create({
                data: {
                  ...baseData,
                  id_worker: workerId
                }
              })
            )
          );
          // Actualizar estado de los nuevos trabajadores
          await this.prisma.worker.updateMany({
            where: { id: { in: workersToAdd } },
            data: { status: 'ASSIGNED' },
          });

          return {
            message: `${workersToAdd.length} workers assigned to operation ${id_operation}`,
            assignedWorkers: workersToAdd,
          };
        }

        return { message: 'No new workers to assign', assignedWorkers: [] };
      }

      return { message: 'No workers to assign', assignedWorkers: [] };
    } catch (error) {
      console.error('Error assigning workers to operation:', error);
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
   * Libera todos los trabajadores asignados a una operación
   * @param id_operation - ID de la operación
   * @returns Resultado de la operación
   */
  async releaseAllWorkersFromOperation(id_operation: number) {
    try {
      // Obtener los trabajadores de esta operación desde la tabla intermedia
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

      // Actualizar el estado de los trabajadores a AVALIABLE
      await this.prisma.worker.updateMany({
        where: {
          id: { in: workerIds },
          status: { not: 'AVALIABLE' },
        },
        data: { status: 'AVALIABLE' },
      });
      return {
        message: `${workerIds.length} workers released from operation ${id_operation}`,
        releasedWorkers: workerIds,
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
}
