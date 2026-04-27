import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { WorkerScheduleDto } from './dto/worker-schedule.dto';
import { BillStatus, StatusComplete, StatusOperation, YES_NO } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RemoveWorkerFromOperationService } from './service/remove-worker-from-operation/remove-worker-from-operation.service';
import { UpdateWorkerSheduleService } from './service/update-worker-shedule/update-worker-shedule.service';
import { AssignWorkerToOperationService } from './service/assign-worker-to-operation/assign-worker-to-operation.service';

@Injectable()
export class OperationWorkerService {
  constructor(
    private prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
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
   * Remueve trabajadores (por ids o grupos) de una operación delegando al servicio especializado
   * @param removeWorkersDto - DTO con { id_operation, workerIds?, workersToRemove? }
   */
  async removeWorkersFromOperation(removeWorkersDto: any) {
    return await this.removerWorkerFromOperationService.removeWorkersFromOperation(
      removeWorkersDto,
    );
  }

  /**
   * Obtiene todos los trabajadores asignados a una operación
   * @param id_operation - ID de la operación
   * @returns Lista de trabajadores asignados
   */
  async getWorkersFromOperation(id_operation: number) {
    try {
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
      });

      if (!operation) {
        return { message: 'Operation not found', status: 404 };
      }

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

      const workers = operationWorkers
        .map((ow) => ow.worker)
        .filter(
          (worker) =>
            worker.status === 'AVALIABLE' || worker.status === 'ASSIGNED',
        );
      return workers;
    } catch (error) {
      console.error('Error getting workers from operation:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
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
    console.log('[OperationWorkerService] updateWorkersSchedule llamado con:');
    console.log('- id_operation:', id_operation);
    console.log('- workersToUpdate:', JSON.stringify(workersToUpdate, null, 2));

    workersToUpdate.forEach((worker, index) => {
      console.log(`[OperationWorkerService] Worker ${index}:`, {
        id_group: worker.id_group,
        workerIds: worker.workerIds,
        id_task: worker.id_task,
        id_subtask: worker.id_subtask,
        id_tariff: worker.id_tariff,
      });

      if (worker.id_subtask === undefined) {
        console.error(
          `[OperationWorkerService] ERROR: Worker ${index} no tiene id_subtask`,
        );
      }
    });

    const scheduleUpdateResult = await this.updateWorkerSheduleService.updateWorkersSchedule(
      id_operation,
      workersToUpdate,
      id_site,
    );

    await this.ensurePreBillsForSpecialOperation(id_operation);

    const completionInfo = await this.completeOperationIfAllGroupsFinished(
      id_operation,
      workersToUpdate,
    );

    return {
      ...(scheduleUpdateResult as object),
      operationCompleted: completionInfo.completed,
      isSpecial: completionInfo.isSpecial,
      newStatus: completionInfo.newStatus,
    };
  }

  /**
   * Verifica si todos los grupos de una operación están completados
   * @param id_operation ID de la operación a verificar
   * @returns true si todos los grupos tienen dateEnd y timeEnd
   */
  async hasAllGroupsCompleted(id_operation: number): Promise<boolean> {
    return this.areAllGroupsCompleted(id_operation);
  }

  /**
   * Verifica internamente si todos los grupos de una operación están completados
   * @param id_operation ID de la operación a verificar
   * @returns true si todos los grupos tienen dateEnd y timeEnd
   */
  private async areAllGroupsCompleted(id_operation: number): Promise<boolean> {
    const allWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation,
        id_worker: { not: -1 },
        id_group: { not: null },
      },
      select: {
        id_group: true,
        dateEnd: true,
        timeEnd: true,
        id_worker: true,
      },
    });

    if (allWorkers.length === 0) {
      return false;
    }

    const groupsMap = new Map<string, any[]>();

    allWorkers.forEach((worker) => {
      const groupId = worker.id_group;
      if (groupId !== null) {
        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, []);
        }
        groupsMap.get(groupId)!.push(worker);
      }
    });

    for (const [, workers] of groupsMap) {
      const incompleteWorkers = workers.filter(
        (w) => w.dateEnd === null || w.timeEnd === null,
      );

      if (incompleteWorkers.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Actualiza una operación a estado COMPLETED o TO_APPROVED cuando todos los grupos están terminados
   * @param id_operation ID de la operación
   * @returns {completed: boolean, isSpecial?: boolean, newStatus?: string}
   */
  private async completeOperationIfAllGroupsFinished(
    id_operation: number,
    workersToUpdate?: WorkerScheduleDto[],
  ): Promise<{ completed: boolean; isSpecial?: boolean; newStatus?: string }> {
    try {
      const allCompleted = await this.areAllGroupsCompleted(id_operation);

      if (!allCompleted) {
        return { completed: false };
      }

      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
        select: {
          status: true,
          id_user: true,
          dateStart: true,
          timeStrat: true,
          dateEnd: true,
          timeEnd: true,
        },
      });

      if (!operation) {
        return { completed: false };
      }

      if (operation.status === 'COMPLETED' || operation.status === 'TO_APPROVED') {
        return { completed: false };
      }

      const specialTariffCount = await this.prisma.operation_Worker.count({
        where: {
          id_operation,
          tariff: {
            isSpecial: YES_NO.YES,
          },
        },
      });

      const isSpecialOperation = specialTariffCount > 0;
      const targetStatus = isSpecialOperation
        ? StatusOperation.TO_APPROVED
        : StatusOperation.COMPLETED;

      if (isSpecialOperation) {
        await this.ensurePreBillsForSpecialOperation(id_operation);
      }

      const latestGroupEnd = await this.getLatestGroupEndDateTime(id_operation);

      let opDuration = 0;
      let finalDateEnd = operation.dateEnd;
      let finalTimeEnd = operation.timeEnd;

      if (latestGroupEnd) {
        finalDateEnd = latestGroupEnd.dateEnd;
        finalTimeEnd = latestGroupEnd.timeEnd;
      }

      if (operation.dateStart && operation.timeStrat && finalDateEnd && finalTimeEnd) {
        const start = new Date(operation.dateStart);
        const [sh, sm] = operation.timeStrat.split(':').map(Number);
        start.setHours(sh, sm, 0, 0);

        const end = new Date(finalDateEnd);
        const [eh, em] = finalTimeEnd.split(':').map(Number);
        end.setHours(eh, em, 0, 0);

        const diffMs = end.getTime() - start.getTime();
        opDuration = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        opDuration = opDuration > 0 ? opDuration : 0;
      }

      await this.prisma.operation.update({
        where: { id: id_operation },
        data: {
          status: targetStatus,
          dateEnd: finalDateEnd,
          timeEnd: finalTimeEnd,
          op_duration: opDuration,
        },
      });

      await this.prisma.operation_Worker.findMany({
        where: { id_operation },
        select: { id_worker: true },
      }).then(async (operationWorkers) => {
        const workerIds = operationWorkers
          .map((ow) => ow.id_worker)
          .filter((id) => id !== -1);

        if (workerIds.length > 0) {
          await this.prisma.worker.updateMany({
            where: {
              id: { in: workerIds },
              status: { not: 'AVALIABLE' },
            },
            data: { status: 'AVALIABLE' },
          });
        }
      });

      console.log(
        `[OperationWorkerService] ✅ Operación ${id_operation} completada: ${targetStatus}, isSpecial: ${isSpecialOperation}`,
      );

      return {
        completed: true,
        isSpecial: isSpecialOperation,
        newStatus: targetStatus,
      };
    } catch (error) {
      console.error(
        `[OperationWorkerService] Error al completar operación ${id_operation}:`,
        error,
      );
      return { completed: false };
    }
  }

  private async ensurePreBillsForSpecialOperation(
    operationId: number,
  ): Promise<void> {
    try {
      const { BillService } = await import('../bill/bill.service');
      const billService = this.moduleRef.get(BillService, { strict: false });

      await billService.ensureSpecialBillsForCompletedGroups(operationId);
    } catch (error) {
      throw new ConflictException(
        'No fue posible generar las prefacturas para la operación especial',
      );
    }
  }

  /**
   * Obtiene la fecha y hora de finalización más reciente entre todos los grupos completados
   * @param id_operation ID de la operación
   * @returns {dateEnd: Date, timeEnd: string} o null si no hay grupos completados
   */
  private async getLatestGroupEndDateTime(id_operation: number): Promise<{ dateEnd: Date; timeEnd: string } | null> {
    try {
      const completedWorkers = await this.prisma.operation_Worker.findMany({
        where: {
          id_operation,
          dateEnd: { not: null },
          timeEnd: { not: null },
          id_worker: { not: -1 },
        },
        select: {
          id_group: true,
          dateEnd: true,
          timeEnd: true,
        },
      });

      if (completedWorkers.length === 0) {
        return null;
      }

      const groupEndTimes = new Map<string, { dateEnd: Date; timeEnd: string }>();

      completedWorkers.forEach((worker) => {
        const groupId = worker.id_group;
        if (groupId && worker.dateEnd && worker.timeEnd && !groupEndTimes.has(groupId)) {
          groupEndTimes.set(groupId, {
            dateEnd: worker.dateEnd,
            timeEnd: worker.timeEnd,
          });
        }
      });

      let latestDateTime: Date | null = null;
      let latestEndInfo: { dateEnd: Date; timeEnd: string } | null = null;

      groupEndTimes.forEach((endInfo) => {
        const fullDateTime = new Date(endInfo.dateEnd);
        const [hours, minutes] = endInfo.timeEnd.split(':').map(Number);
        fullDateTime.setHours(hours, minutes, 0, 0);

        if (!latestDateTime || fullDateTime > latestDateTime) {
          latestDateTime = fullDateTime;
          latestEndInfo = endInfo;
        }
      });

      return latestEndInfo;
    } catch (error) {
      console.error(`[OperationWorkerService] Error obteniendo fecha más reciente para operación ${id_operation}:`, error);
      return null;
    }
  }

  async finalizeGroup(
    id_operation: number,
    id_group: string,
    dateEnd: string,
    timeEnd: string,
  ) {
    const parsedDateEnd = new Date(dateEnd);
    if (Number.isNaN(parsedDateEnd.getTime())) {
      throw new BadRequestException('dateEnd invalido para finalizar grupo');
    }

    console.log(
      `[OperationWorkerService] Finalizando grupo ${id_group} con fecha/hora: ${parsedDateEnd.toISOString()} ${timeEnd}`,
    );

    const groupWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation,
        id_group,
        id_worker: { not: -1 },
      },
      select: { id: true },
    });

    if (groupWorkers.length === 0) {
      throw new BadRequestException(
        `No se encontro el grupo ${id_group} en la operacion ${id_operation}`,
      );
    }

    const updateResult = await this.prisma.operation_Worker.updateMany({
      where: {
        id_operation,
        id_group,
        id_worker: { not: -1 },
      },
      data: {
        dateEnd: parsedDateEnd,
        timeEnd,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException(
        `No se pudo actualizar el grupo ${id_group} en la operacion ${id_operation}`,
      );
    }

    await this.ensurePreBillsForSpecialOperation(id_operation);

    const completionInfo = await this.completeOperationIfAllGroupsFinished(id_operation);

    return {
      ...updateResult,
      operationCompleted: completionInfo.completed,
      isSpecial: completionInfo.isSpecial,
      newStatus: completionInfo.newStatus,
    };
  }

  /**
   * Marca la programación del cliente asociada a la operación como COMPLETED (si existe)
   * @param id_operation
   */
  async completeClientProgramming(id_operation: number) {
    try {
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
        select: { id_clientProgramming: true },
      });

      if (!operation || !operation.id_clientProgramming) return null;

      await this.prisma.clientProgramming.update({
        where: { id: operation.id_clientProgramming },
        data: { status: 'COMPLETED' },
      });

      return { message: 'Client programming completed', id: operation.id_clientProgramming };
    } catch (error) {
      console.error('[OperationWorkerService] Error completing client programming:', error);
      throw error;
    }
  }
}
