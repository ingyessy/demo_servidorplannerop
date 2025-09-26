import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { WorkerScheduleDto } from './dto/worker-schedule.dto';
import { StatusComplete } from '@prisma/client';
import { RemoveWorkerFromOperationService } from './service/remove-worker-from-operation/remove-worker-from-operation.service';
import { UpdateWorkerSheduleService } from './service/update-worker-shedule/update-worker-shedule.service';
import { AssignWorkerToOperationService } from './service/assign-worker-to-operation/assign-worker-to-operation.service';

@Injectable()
export class OperationWorkerService {
  constructor(
    private prisma: PrismaService,
    private readonly removerWorkerFromOperationService: RemoveWorkerFromOperationService,
    private readonly updateWorkerSheduleService: UpdateWorkerSheduleService,
    private readonly assingWorkerToOperationService: AssignWorkerToOperationService,
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
    return await this.assingWorkerToOperationService.assignWorkersToOperation(
      assignWorkersDto,
      id_subsite,
      id_site,
    );
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
    return await this.removerWorkerFromOperationService.removeWorkersFromOperation(
      removeWorkersDto,
    );
  }
  /**
   *  Libera todos los trabajadores de una operación
   * @param id_operation
   * @returns Resultado de la liberación
   */
  async releaseAllWorkersFromOperation(id_operation: number) {
    return await this.removerWorkerFromOperationService.releaseAllWorkersFromOperation(
      id_operation,
    );
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

     // Filtrar solo trabajadores con status AVALIABLE o ASSIGNED
    const workers = operationWorkers
      .map((ow) => ow.worker)
      .filter((worker) => 
        worker.status === 'AVALIABLE' || worker.status === 'ASSIGNED'
      );
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
    id_site?: number | null,
  ) {
    return await this.updateWorkerSheduleService.updateWorkersSchedule(
      id_operation,
      workersToUpdate,
      id_site,
    );
  }


  async finalizeGroup(
  id_operation: number,
  id_group: number,
  dateEnd: Date,
  timeEnd: string,
) {
  return await this.prisma.operation_Worker.updateMany({
    where: {
      id_operation,
      id_group: id_group.toString(),
      dateEnd: null,
      timeEnd: null,
    },
    data: {
      dateEnd,
      timeEnd,
    },
  });
}

}