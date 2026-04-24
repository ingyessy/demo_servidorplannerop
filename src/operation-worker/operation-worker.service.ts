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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
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

    // ✅ VERIFICAR QUE CADA WORKER TENGA id_subtask
    workersToUpdate.forEach((worker, index) => {
      console.log(`[OperationWorkerService] Worker ${index}:`, {
        id_group: worker.id_group,
        workerIds: worker.workerIds,
        id_task: worker.id_task,
        id_subtask: worker.id_subtask, // ✅ VERIFICAR QUE ESTÉ
        id_tariff: worker.id_tariff,
      });

      if (worker.id_subtask === undefined) {
        console.error(
          `[OperationWorkerService] ERROR: Worker ${index} no tiene id_subtask`,
        );
      }
    });

    // Llamar al servicio específico
    const scheduleUpdateResult = await this.updateWorkerSheduleService.updateWorkersSchedule(
      id_operation,
      workersToUpdate,
      id_site,
    );

    // Si al actualizar horarios se completó el último grupo, cerrar la operación automáticamente.
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
    // console.log(`[DEBUG] 🔍 Verificando si todos los grupos de operación ${id_operation} están completados...`);
    
    // Obtener todos los registros de operation_Worker para esta operación
    const allWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation,
        id_worker: { not: -1 }, // Excluir placeholders
        id_group: { not: null }, // Excluir grupos nulos
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

    // Agrupar por id_group y verificar que cada grupo tenga al menos un trabajador completado
    const groupsMap = new Map<string, any[]>();
    
    allWorkers.forEach(worker => {
      const groupId = worker.id_group;
      if (groupId !== null) { // Verificación adicional por seguridad
        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, []);
        }
        groupsMap.get(groupId)!.push(worker);
      }
    });


    let allGroupsCompleted = true;
    
    for (const [groupId, workers] of groupsMap) {
      const completedWorkers = workers.filter(w => w.dateEnd !== null && w.timeEnd !== null);
      const incompleteWorkers = workers.filter(w => w.dateEnd === null || w.timeEnd === null);
      
      // console.log(`[DEBUG] 📊 Grupo ${groupId}:`);
      // console.log(`  - Total trabajadores: ${workers.length}`);
      // console.log(`  - Completados: ${completedWorkers.length}`);
      // console.log(`  - Incompletos: ${incompleteWorkers.length}`);
      
      if (incompleteWorkers.length > 0) {
        // console.log(`[DEBUG] ❌ Grupo ${groupId} NO está completado (${incompleteWorkers.length} trabajadores sin finalizar)`);
        // incompleteWorkers.forEach(w => {
        // //   console.log(`    - Worker ${w.id_worker}: dateEnd=${w.dateEnd}, timeEnd=${w.timeEnd}`);
        // });
        allGroupsCompleted = false;
      } 
      // else {
      //   console.log(`[DEBUG] ✅ Grupo ${groupId} está completado`);
      // }
    }

    // console.log(`[DEBUG] 🏁 Resultado final: ${allGroupsCompleted ? 'TODOS los grupos están completados' : 'AÚN hay grupos incompletos'}`);
    return allGroupsCompleted;
  }

  /**
   * Actualiza una operación a estado COMPLETED o TO_APPROVED cuando todos los grupos están terminados
   * @param id_operation ID de la operación
   * @returns {completed: boolean, isSpecial?: boolean, newStatus?: string}
   */
  private async completeOperationIfAllGroupsFinished(
    id_operation: number,
    workersToUpdate?: WorkerScheduleDto[],
  ): Promise<{completed: boolean; isSpecial?: boolean; newStatus?: string}> {
    try {
      // Verificar si todos los grupos están completados
      const allCompleted = await this.areAllGroupsCompleted(id_operation);
      
      if (!allCompleted) {
        return { completed: false };
      }

      // Obtener la operación actual para verificar estado
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
        select: { 
          status: true, 
          id_user: true,
          dateStart: true, 
          timeStrat: true,
          dateEnd: true,
          timeEnd: true 
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
        await this.ensurePreBillsForSpecialOperation(
          id_operation,
          operation.id_user ?? 1,
          workersToUpdate,
        );
      }

      // 🆕 OBTENER LA FECHA MÁS RECIENTE DE FINALIZACIÓN DE TODOS LOS GRUPOS
      const latestGroupEnd = await this.getLatestGroupEndDateTime(id_operation);
      
      let opDuration = 0;
      let finalDateEnd = operation.dateEnd;
      let finalTimeEnd = operation.timeEnd;

      // Si encontramos una fecha de finalización más reciente, usarla
      if (latestGroupEnd) {
        finalDateEnd = latestGroupEnd.dateEnd;
        finalTimeEnd = latestGroupEnd.timeEnd;
      }

      // Calcular duración basándose en fecha de inicio y la fecha de finalización más reciente
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

      // Actualizar operacion con fecha/hora de finalizacion y estado segun tipo
      await this.prisma.operation.update({
        where: { id: id_operation },
        data: { 
          status: targetStatus,
          dateEnd: finalDateEnd,
          timeEnd: finalTimeEnd,
          op_duration: opDuration
        },
      });

      // Liberar trabajadores (cambiar estado a AVAILABLE)
      await this.prisma.operation_Worker.findMany({
        where: { id_operation },
        select: { id_worker: true },
      }).then(async (operationWorkers) => {
        const workerIds = operationWorkers
          .map(ow => ow.id_worker)
          .filter(id => id !== -1);

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
    userId: number,
    workersToUpdate?: WorkerScheduleDto[],
  ): Promise<void> {
    const existingBills = await this.prisma.bill.count({
      where: { id_operation: operationId },
    });

    if (existingBills > 0) {
      return;
    }

    const operationWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation: operationId,
        id_worker: { not: -1 },
      },
      select: {
        id_worker: true,
        id_group: true,
        id_tariff: true,
        dateStart: true,
        timeStart: true,
        dateEnd: true,
        timeEnd: true,
      },
    });

    if (!operationWorkers.length) {
      throw new ConflictException(
        `No se encontraron trabajadores/grupos para facturar la operación ${operationId}`,
      );
    }

    const uniqueGroups = [
      ...new Set(
        operationWorkers
          .map((ow) => ow.id_group)
          .filter((groupId): groupId is string => !!groupId),
      ),
    ];

    if (!uniqueGroups.length) {
      throw new ConflictException(
        `No se encontraron grupos válidos para facturar la operación ${operationId}`,
      );
    }

    const quantityByGroup = new Map<string, number>();
    for (const workerGroup of workersToUpdate || []) {
      if (!workerGroup.id_group) {
        continue;
      }

      const explicitQuantity =
        Number(workerGroup.number_of_hours ?? workerGroup.group_hours ?? 0) || 0;

      if (explicitQuantity > 0) {
        quantityByGroup.set(workerGroup.id_group, explicitQuantity);
      }
    }

    const tariffIds = [
      ...new Set(
        operationWorkers
          .map((ow) => ow.id_tariff)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];

    const tariffs = tariffIds.length
      ? await this.prisma.tariff.findMany({
          where: { id: { in: tariffIds } },
          select: {
            id: true,
            pay_units: true,
            unitOfMeasure: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

    const unitByTariffId = new Map<number, string>();
    const quantityByTariffId = new Map<number, number>();
    for (const tariff of tariffs) {
      unitByTariffId.set(
        tariff.id,
        (tariff.unitOfMeasure?.name || '').trim().toUpperCase(),
      );
      quantityByTariffId.set(tariff.id, Number(tariff.pay_units ?? 0));
    }

    const billGroups = uniqueGroups.map((groupId) => {
      const groupWorkers = operationWorkers.filter((ow) => ow.id_group === groupId);
      const representativeTariffId = groupWorkers.find(
        (ow) => typeof ow.id_tariff === 'number',
      )?.id_tariff;
      const unitName = representativeTariffId
        ? unitByTariffId.get(representativeTariffId)
        : '';
      const isTimeBasedUnit = unitName === 'HORAS' || unitName === 'JORNAL';
      const tariffQuantity = representativeTariffId
        ? Number(quantityByTariffId.get(representativeTariffId) ?? 0)
        : 0;
      const workerDurations = groupWorkers
        .map((ow) => {
          if (!ow.dateStart || !ow.timeStart || !ow.dateEnd || !ow.timeEnd) {
            return 0;
          }

          const start = new Date(ow.dateStart);
          const [sh, sm] = ow.timeStart.split(':').map(Number);
          start.setHours(sh, sm, 0, 0);

          const end = new Date(ow.dateEnd);
          const [eh, em] = ow.timeEnd.split(':').map(Number);
          end.setHours(eh, em, 0, 0);

          const diffHours = (end.getTime() - start.getTime()) / 3_600_000;
          return diffHours > 0 ? diffHours : 0;
        })
        .filter((hours) => hours > 0);

      const groupHours =
        workerDurations.length > 0
          ? Math.round(
              (workerDurations.reduce((sum, hours) => sum + hours, 0) /
                workerDurations.length) *
                100,
            ) / 100
          : 0;

      const explicitQuantity = quantityByGroup.get(groupId) || 0;
      const fallbackQuantity = groupWorkers.length > 0 ? groupWorkers.length : 1;
      const quantityForBilling =
        explicitQuantity > 0
          ? explicitQuantity
          : tariffQuantity > 0
            ? tariffQuantity
            : fallbackQuantity;

      if (!isTimeBasedUnit && explicitQuantity <= 0 && tariffQuantity <= 0) {
        console.warn(
          `[OperationWorkerService][Prefactura][FallbackQuantity] operation=${operationId} group=${groupId} unit=${unitName || 'N/A'} fallbackWorkers=${fallbackQuantity}`,
        );
      }

      const amountBase = isTimeBasedUnit
        ? groupHours > 0
          ? groupHours
          : 1
        : quantityForBilling > 0
          ? quantityForBilling
          : 1;

      const hoursDistributionBase = isTimeBasedUnit ? groupHours : 0;
      const numberOfHoursValue = isTimeBasedUnit
        ? groupHours
        : quantityForBilling > 0
          ? quantityForBilling
          : 1;

      console.log(
        `[OperationWorkerService][Prefactura][DTO] operation=${operationId} group=${groupId} unit=${unitName || 'N/A'} explicitQuantity=${explicitQuantity} tariffQuantity=${tariffQuantity} amount=${amountBase}`,
      );

      return {
        id: groupId,
        amount: amountBase,
        group_hours: new Decimal(groupHours),
        number_of_hours: numberOfHoursValue,
        pays: groupWorkers.map((ow) => ({
          id_worker: ow.id_worker,
          pay: 1,
        })),
        paysheetHoursDistribution: {
          HOD: hoursDistributionBase,
          HON: 0,
          HED: 0,
          HEN: 0,
          HFOD: 0,
          HFON: 0,
          HFED: 0,
          HFEN: 0,
        },
        billHoursDistribution: {
          HOD: hoursDistributionBase,
          HON: 0,
          HED: 0,
          HEN: 0,
          HFOD: 0,
          HFON: 0,
          HFED: 0,
          HFEN: 0,
        },
      };
    });

    try {
      const { BillService } = await import('../bill/bill.service');
      const billService = this.moduleRef.get(BillService, { strict: false });

      await billService.create(
        {
          id_operation: operationId,
          groups: billGroups,
        },
        userId,
        {
          billStatus: 'TO_APPROVED' as BillStatus,
          skipOperationCompletion: true,
        },
      );
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
  private async getLatestGroupEndDateTime(id_operation: number): Promise<{dateEnd: Date, timeEnd: string} | null> {
    try {
      // console.log(`[OperationWorkerService] 🔍 Buscando fecha más reciente de finalización para operación ${id_operation}...`);
      
      // Obtener todos los registros completados de la operación (con dateEnd y timeEnd)
      const completedWorkers = await this.prisma.operation_Worker.findMany({
        where: {
          id_operation,
          dateEnd: { not: null },
          timeEnd: { not: null },
          id_worker: { not: -1 }, // Excluir placeholders
        },
        select: {
          id_group: true,
          dateEnd: true,
          timeEnd: true,
        },
      });

      if (completedWorkers.length === 0) {
        // console.log(`[OperationWorkerService] ⚠️ No se encontraron grupos completados para operación ${id_operation}`);
        return null;
      }

      // Agrupar por id_group para obtener las fechas únicas de cada grupo
      const groupEndTimes = new Map<string, {dateEnd: Date, timeEnd: string}>();
      
      completedWorkers.forEach(worker => {
        const groupId = worker.id_group;
        if (groupId && worker.dateEnd && worker.timeEnd && !groupEndTimes.has(groupId)) {
          groupEndTimes.set(groupId, {
            dateEnd: worker.dateEnd,
            timeEnd: worker.timeEnd
          });
        }
      });

      // console.log(`[OperationWorkerService] 📊 Encontrados ${groupEndTimes.size} grupos completados:`);
      
      // Encontrar la fecha más reciente
      let latestDateTime: Date | null = null;
      let latestEndInfo: {dateEnd: Date, timeEnd: string} | null = null;

      groupEndTimes.forEach((endInfo, groupId) => {
        // Crear objeto Date completo para comparación
        const fullDateTime = new Date(endInfo.dateEnd);
        const [hours, minutes] = endInfo.timeEnd.split(':').map(Number);
        fullDateTime.setHours(hours, minutes, 0, 0);
        
        // console.log(`[OperationWorkerService]   - Grupo ${groupId}: ${endInfo.dateEnd.toISOString().split('T')[0]} ${endInfo.timeEnd} (${fullDateTime.toISOString()})`);

        if (!latestDateTime || fullDateTime > latestDateTime) {
          latestDateTime = fullDateTime;
          latestEndInfo = endInfo;
        }
      });

      if (latestEndInfo) {
        const endInfo = latestEndInfo as {dateEnd: Date, timeEnd: string};
        // console.log(`[OperationWorkerService] 🏆 Fecha más reciente: ${endInfo.dateEnd.toISOString().split('T')[0]} ${endInfo.timeEnd}`);
      }

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

    // 1. Verificar que el grupo exista en la operacion (excluyendo placeholders)
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

    // 2. Actualizar el grupo con fecha y hora de finalizacion
    const updateResult = await this.prisma.operation_Worker.updateMany({
      where: {
        id_operation,
        id_group,
        id_worker: { not: -1 }, // ✅ EXCLUIR PLACEHOLDERS
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

    // 3. Verificar si todos los grupos están completados y actualizar operación si es necesario
    const completionInfo = await this.completeOperationIfAllGroupsFinished(id_operation);

    return {
      ...updateResult,
      operationCompleted: completionInfo.completed,
      isSpecial: completionInfo.isSpecial,
      newStatus: completionInfo.newStatus,
    };
  }
}
