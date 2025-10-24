import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationWorkerService } from 'src/operation-worker/operation-worker.service';
import { StatusComplete, StatusOperation } from '@prisma/client';
import { OperationFinderService } from './services/operation-finder.service';
import { OperationRelationService } from './services/operation-relation.service';
import { OperationFilterDto } from './dto/fliter-operation.dto';
import { WorkerService } from 'src/worker/worker.service';
import { RemoveWorkerFromOperationService } from '../operation-worker/service/remove-worker-from-operation/remove-worker-from-operation.service';
// ... otras importaciones
/**
 * Servicio para gestionar operaciones
 * @class OperationService
 */
@Injectable()
export class OperationService {
  constructor(
    private prisma: PrismaService,
    private operationWorkerService: OperationWorkerService,
    private finderService: OperationFinderService,
    private relationService: OperationRelationService,
    private workerService: WorkerService,
    private removeWorkerService: RemoveWorkerFromOperationService,
  ) {}
  /**
   * Obtiene todas las operaciones
   * @returns Lista de operaciones con relaciones incluidas
   */
  async findAll(id_site?: number, id_subsite?: number) {
    return await this.finderService.findAll(id_site, id_subsite);
  }
  /**
   * Busca una operación por su ID
   * @param id - ID de la operación a buscar
   * @returns Operación encontrada o mensaje de error
   */
  async findOne(id: number, id_site?: number, id_subsite?: number) {
    return await this.finderService.findOne(id, id_site, id_subsite);
  }
  /**
   * Obtiene una operación con detalles de tarifas
   * @param operationId - ID de la operación a buscar
   * @returns Operación con detalles de tarifas o mensaje de error
   */
  async getOperationWithDetailedTariffs(operationId: number) {
    return await this.finderService.getOperationWithDetailedTariffs(
      operationId,
    );
  }
  /**
   * Encuentra todas las operaciones activas (IN_PROGRESS y PENDING) sin filtros de fecha
   * @returns Lista de operaciones activas o mensaje de error
   */
  async findActiveOperations(
    statuses: StatusOperation[],
    id_site?: number,
    id_subsite?: number,
  ) {
    return await this.finderService.findByStatuses(
      statuses,
      id_site,
      id_subsite,
    );
  }
  /**
   *  Busca operaciones por rango de fechas
   * @param start Fecha de inicio
   * @param end Fecha de fin
   * @returns resultado de la busqueda
   */
  async findOperationRangeDate(
    start: Date,
    end: Date,
    id_site?: number,
    id_subsite?: number,
  ) {
    return await this.finderService.findByDateRange(
      start,
      end,
      id_site,
      id_subsite,
    );
  }
  /**
   * Encuentra operaciones asociadas a un usuario específico
   * @param id_user ID del usuario para buscar operaciones
   * @returns  Lista de operaciones asociadas al usuario o mensaje de error
   */
  async findOperationByUser(
    id_user: number,
    id_site?: number,
    id_subsite?: number,
  ) {
    return await this.finderService.findByUser(id_user, id_site, id_subsite);
  }
  /**
   * Obtener operaciones con paginación y filtros opcionales
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: OperationFilterDto,
    activatePaginated: boolean = true,
  ) {
    return this.finderService.findAllPaginated(
      page,
      limit,
      filters,
      activatePaginated,
    );
  }
  /**
   * Crea una nueva operación y asigna trabajadores
   * @param createOperationDto - Datos de la operación a crear
   * @returns Operación creada
   */
  async createWithWorkers(
    createOperationDto: CreateOperationDto,
    id_subsite?: number,
    id_site?: number,
  ) {
    try {
      if (createOperationDto.id_subsite) {
        id_subsite = createOperationDto.id_subsite;
      }

      // Obtener el usuario y su rol (ajusta según tu modelo)
      const user = await this.prisma.user.findUnique({
        where: { id: createOperationDto.id_user },
        select: { role: true },
      });

      // Validar fecha para SUPERVISOR
      if (user?.role === 'SUPERVISOR' && createOperationDto.dateStart) {
        const now = new Date();
        const dateStart = new Date(createOperationDto.dateStart);
        const diffMs = now.getTime() - dateStart.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 48) {
          return {
            message:
              'Como SUPERVISOR solo puedes crear operaciones con máximo 48 horas de antigüedad.',
            status: 400,
          };
        }
      }

      // Validaciones
      if (createOperationDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }

      // Extraer y validar IDs de trabajadores
      const { workerIds = [], groups = [] } = createOperationDto;
      const scheduledWorkerIds =
        this.relationService.extractScheduledWorkerIds(groups);
      const allWorkerIds = [...workerIds, ...scheduledWorkerIds];

      const validateWorkerIds = await this.relationService.validateWorkerIds(
        allWorkerIds,
        id_subsite,
        id_site,
      );
      if (validateWorkerIds?.status === 403) {
        return validateWorkerIds;
      }
      //validar programacion cliente
      const validateClientProgramming =
        await this.relationService.validateClientProgramming(
          createOperationDto.id_clientProgramming || null,
        );

      if (validateClientProgramming) return validateClientProgramming;

      // Validar todos los IDs
      const validationResult = await this.relationService.validateOperationIds(
        {
          id_area: createOperationDto.id_area,
          id_task: createOperationDto.id_task,
          id_client: createOperationDto.id_client,
          workerIds: allWorkerIds,
          inChargedIds: createOperationDto.inChargedIds,
        },
        groups,
        id_site,
      );

      if (
        validationResult &&
        validationResult.status &&
        validationResult.status !== 200
      ) {
        return validationResult;
      }

      // Crear la operación
      const operation = await this.createOperation(
        createOperationDto,
        id_subsite,
      );

      // VERIFICAR SI HAY ERROR ANTES DE ACCEDER A 'id'
      if ('status' in operation && 'message' in operation) {
        return operation;
      }
      // Asignar trabajadores y encargados
      const response = await this.relationService.assignWorkersAndInCharge(
        operation.id,
        workerIds,
        groups,
        createOperationDto.inChargedIds || [],
        id_subsite,
        id_site,
      );
      if (response && (response.status === 403 || response.status === 400)) {
        return response;
      }
      return { id: operation.id };
    } catch (error) {
      console.error('Error creating operation with workers:', error);
      throw new Error(error.message);
    }
  }

  private calculateOperationDuration(
    dateStart: Date,
    timeStrat: string,
    dateEnd: Date,
    timeEnd: string,
  ): number {
    if (!dateStart || !timeStrat || !dateEnd || !timeEnd) return 0;

    const start = new Date(dateStart);
    const [sh, sm] = timeStrat.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(dateEnd);
    const [eh, em] = timeEnd.split(':').map(Number);
    end.setHours(eh, em, 0, 0);

    const diffMs = end.getTime() - start.getTime();
    const durationHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // 2 decimales
    return durationHours > 0 ? durationHours : 0;
  }

  /**
   * Crea un registro de operación
   * @param operationData - Datos de la operación
   * @returns Operación creada
   */
  private async createOperation(
    operationData: CreateOperationDto,
    id_subsite?: number,
  ) {
    const {
      workerIds,
      groups,
      inChargedIds,
      dateStart,
      dateEnd,
      timeStrat,
      timeEnd,
      id_clientProgramming,
      id_task,
      ...restOperationData
    } = operationData;

    // Si id_task no viene en operationData, pero sí en el primer grupo, úsalo
    const mainTaskId =
      id_task ||
      (groups && groups.length > 0 && groups[0].id_task
        ? groups[0].id_task
        : null);

    if (id_subsite !== undefined) {
      if (operationData.id_subsite !== id_subsite) {
        return { message: 'Subsite does not match', status: 400 };
      }
    }
    const newOperation = await this.prisma.operation.create({
      data: {
        ...restOperationData,
        id_user: operationData.id_user as number,
        id_clientProgramming: id_clientProgramming || null,
        id_task: mainTaskId ? Number(mainTaskId) : null,
        dateStart: dateStart ? new Date(dateStart) : '',
        dateEnd: dateEnd ? new Date(dateEnd) : null,
        timeStrat: timeStrat || '',
        timeEnd: timeEnd || null,
        id_subsite: id_subsite || null,
      },
    });

    if (id_clientProgramming) {
      await this.prisma.clientProgramming.update({
        where: { id: id_clientProgramming },
        data: {
          status: StatusComplete.ASSIGNED,
        },
      });
    }
    return newOperation;
  }
  /**
   * Actualiza una operación existente
   * @param id - ID de la operación a actualizar
   * @param updateOperationDto - Datos de actualización
   * @returns Operación actualizada
   */
  async update(
  id: number,
  updateOperationDto: UpdateOperationDto,
  id_subsite?: number,
  id_site?: number,
) {
  try {
    console.log('[OperationService] Iniciando actualización de operación:', id);
    console.log('[OperationService] DTO recibido:', JSON.stringify(updateOperationDto, null, 2));

    // Verify operation exists
    const validate = await this.findOne(id);
    if (validate['status'] === 404) {
      return validate;
    }

    // Validate inCharged IDs
    const validationResult =
      await this.relationService.validateInChargedIds(updateOperationDto);
    if (validationResult) return validationResult;

    // Extract data for update
    const {
      workers,
      inCharged,
      dateStart,
      dateEnd,
      timeStrat,
      timeEnd,
      ...directFields
    } = updateOperationDto;

    // Process workers
    if (workers) {
      console.log('[OperationService] Procesando workers con nuevo flujo V2');
      await this.processWorkersOperationsV2(id, workers);
    }

    // Process inCharged
    if (inCharged) {
      console.log('[OperationService] Procesando inCharged directamente');
      await this.processInChargedOperations(id, inCharged);
    }

    // ✅ PASAR TODOS LOS PARÁMETROS DE FECHA/HORA AL MÉTODO
    const operationUpdateData = this.prepareOperationUpdateData(
      directFields,
      dateStart,
      dateEnd,
      timeStrat,
      timeEnd, // ✅ ASEGURAR QUE SE PASE timeEnd
    );

    // Update operation
    if (Object.keys(operationUpdateData).length > 0) {
      console.log('[OperationService] Actualizando datos básicos de la operación');
      console.log('[OperationService] Datos a actualizar:', operationUpdateData);
      
      await this.prisma.operation.update({
        where: { id },
        data: operationUpdateData,
      });
    }

    // Handle status change
    if (directFields.status === StatusOperation.COMPLETED) {
      const operation = await this.prisma.operation.findUnique({
        where: { id },
      });

      if (
        operation &&
        operation.dateStart &&
        operation.timeStrat &&
        operation.dateEnd &&
        operation.timeEnd
      ) {
        const opDuration = this.calculateOperationDuration(
          operation.dateStart,
          operation.timeStrat,
          operation.dateEnd,
          operation.timeEnd,
        );

        // Actualiza el campo op_duration
        await this.prisma.operation.update({
          where: { id },
          data: { op_duration: opDuration },
        });
      }

      // ✅ CAMBIAR EL ORDEN: PRIMERO ACTUALIZAR FECHAS, LUEGO CALCULAR HORAS
      await this.operationWorkerService.completeClientProgramming(id);
      await this.operationWorkerService.releaseAllWorkersFromOperation(id);
      await this.workerService.addWorkedHoursOnOperationEnd(id);
    }

    // Get updated operation
    const updatedOperation = await this.findOne(id);
    console.log('[OperationService] Operación actualizada exitosamente');
    return updatedOperation;
  } catch (error) {
    console.error('Error updating operation:', error);
    throw new Error(error.message);
  }

  
}

  /**
   * Prepara los datos para actualizar una operación
   * @param directFields - Campos directos a actualizar
   * @param dateStart - Fecha de inicio
   * @param dateEnd - Fecha de fin
   * @param timeStrat - Hora de inicio
   * @param timeEnd - Hora de fin
   * @returns Objeto con datos preparados para actualizar
   */
  private prepareOperationUpdateData(
    directFields: any,
    dateStart?: string,
    dateEnd?: string,
    timeStrat?: string,
    timeEnd?: string,
  ) {
    const updateData = { ...directFields };

    // Eliminar campos que NO pertenecen a la tabla Operation
    delete updateData.workers;      // Este es del DTO, no de la tabla
    delete updateData.inCharged;    // Este es del DTO, no de la tabla
    delete updateData.workerIds;    // Este es del DTO, no de la tabla
    delete updateData.inChargedIds; // Este es del DTO, no de la tabla
    delete updateData.groups;       // Este es del DTO, no de la tabla
    delete updateData.removedWorkerIds; // Este es del DTO, no de la tabla
    delete updateData.originalWorkerIds; // Este es del DTO, no de la tabla
    delete updateData.updatedGroups; // Este es del DTO, no de la tabla
    delete updateData.id_tariff;    //  NO EXISTE EN Operation - viene de worker/grupo
    delete updateData.id_subtask;   //  NO EXISTE EN Operation - viene de worker/grupo
    delete updateData.id_task_worker; //  NO EXISTE EN Operation - viene de worker/grupo

    // MANTENER solo los campos que SÍ existen en la tabla Operation según el schema:
    // - status, zone, motorShip, dateStart, dateEnd, timeStrat, timeEnd
    // - createAt, updateAt, op_duration
    // - id_area, id_client, id_clientProgramming, id_user, id_task, id_site, id_subsite

    console.log('[OperationService] Campos después de limpieza:', Object.keys(updateData));

    
  // ✅ PROCESAR FECHAS Y HORAS RESPETANDO LO QUE ENVÍA EL USUARIO
  if (dateStart) updateData.dateStart = new Date(dateStart);
  
  // ✅ MANEJAR FECHA DE FIN
  if (dateEnd) {
    updateData.dateEnd = new Date(dateEnd);
  } else if (updateData.status === StatusOperation.COMPLETED && !dateEnd) {
    // Solo establecer fecha actual si el usuario NO envió dateEnd
    updateData.dateEnd = new Date();
  }
  
  // ✅ MANEJAR HORA DE INICIO
  if (timeStrat) updateData.timeStrat = timeStrat;
  
  // ✅ MANEJAR HORA DE FIN - RESPETAR LA HORA DEL USUARIO
  if (timeEnd) {
    // ✅ SI EL USUARIO ENVÍA timeEnd, USARLA SIEMPRE
    updateData.timeEnd = timeEnd;
    console.log(`[OperationService] Usando hora de fin enviada por el usuario: ${timeEnd}`);
  } else if (updateData.status === StatusOperation.COMPLETED) {
    // ✅ SOLO SI NO VIENE timeEnd Y SE ESTÁ COMPLETANDO, USAR HORA ACTUAL
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    updateData.timeEnd = `${hh}:${mm}`;
    console.log(`[OperationService] No se recibió timeEnd, usando hora actual: ${updateData.timeEnd}`);
  }

    console.log('[OperationService] Datos finales para actualizar Operation:', updateData);
    return updateData;
  }
  /**
   * Elimina una operación por su ID
   * @param id - ID de la operación a eliminar
   * @returns Operación eliminadar
   */
  async remove(id: number, id_site?: number, id_subsite?: number) {
    try {
      const validateOperation = await this.findOne(id);
      if (validateOperation['status'] === 404) {
        return validateOperation;
      }

      if (id_site !== undefined) {
        if (validateOperation.id_site !== id_site) {
          return { message: 'Site does not match', status: 400 };
        }
      }

      if (id_subsite !== undefined) {
        if (validateOperation.id_subsite !== id_subsite) {
          return { message: 'Subsite does not match', status: 400 };
        }
      }

      // Usar transacción para eliminar la operación y sus dependencias
      return await this.prisma.$transaction(async (tx) => {
        // 1. Eliminar todos los trabajadores asignados a la operación
        await tx.operation_Worker.deleteMany({
          where: { id_operation: id },
        });

        // 2. Eliminar encargados si existen
        try {
          await tx.inChargeOperation.deleteMany({
            where: { id_operation: id },
          });
        } catch (error) {
          // Si la tabla no existe, continuar
        }

        // 3. Eliminar la operación
        const response = await tx.operation.delete({
          where: { id },
        });

        return response;
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Elimina completamente una operación cancelada (para uso del cron)
   * @param id - ID de la operación a eliminar
   */
  async removeCompletely(id: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Eliminar Operation_Worker
      await tx.operation_Worker.deleteMany({
        where: { id_operation: id },
      });

      // 2. Eliminar InCharged
      try {
        await tx.inChargeOperation.deleteMany({
          where: { id_operation: id },
        });
      } catch (error) {
        // Continuar si la tabla no existe
      }

      // 3. Eliminar la operación
      return await tx.operation.delete({
        where: { id },
      });
    });
  }

  private async processWorkersOperationsV2(operationId: number, workersOps: any) {
  console.log('[OperationService] Procesando operaciones de trabajadores V2:', JSON.stringify(workersOps, null, 2));

  // 1. DESCONECTAR/ELIMINAR TRABAJADORES (mantener igual)
  if (workersOps.disconnect && Array.isArray(workersOps.disconnect) && workersOps.disconnect.length > 0) {
    console.log('[OperationService] Eliminando trabajadores:', workersOps.disconnect);
    
    for (const disconnectOp of workersOps.disconnect) {
      console.log('[OperationService] Procesando eliminación individual:', disconnectOp);
      
      if (!disconnectOp.id || isNaN(Number(disconnectOp.id))) {
        console.error('[OperationService] ID de trabajador inválido:', disconnectOp.id);
        throw new BadRequestException(`ID de trabajador inválido: ${disconnectOp.id}`);
      }
      
      const workerId = Number(disconnectOp.id);
      console.log('[OperationService] ID de trabajador convertido a número:', workerId);
      
      try {
        if (disconnectOp.id_group) {
          console.log('[OperationService] Eliminando trabajador del grupo específico');
          const removeResult = await this.removeWorkerService.removeWorkerFromGroup(
            operationId,
            workerId,
            disconnectOp.id_group
          );
          console.log('[OperationService] Trabajador eliminado del grupo:', removeResult);
        } else {
          console.log('[OperationService] Eliminando trabajador de toda la operación');
          const removeResult = await this.removeWorkerService.removeWorkerFromOperation(
            operationId,
            workerId
          );
          console.log('[OperationService] Trabajador eliminado de la operación:', removeResult);
        }
      } catch (error) {
        console.error('[OperationService] Error eliminando trabajador:', error);
        throw error;
      }
    }
  }

  // 2. CONECTAR/AGREGAR NUEVOS TRABAJADORES - ✅ CORREGIR AQUÍ
  if (workersOps.connect && workersOps.connect.length > 0) {
    console.log('[OperationService] Agregando trabajadores:', workersOps.connect);
    
    for (const connectOp of workersOps.connect) {
      console.log('[OperationService] Procesando conexión:', connectOp);
      
      // ✅ VERIFICAR QUE workerIds EXISTE Y ES UN ARRAY
      if (!connectOp.workerIds || !Array.isArray(connectOp.workerIds)) {
        console.error('[OperationService] workerIds no encontrado o no es array:', connectOp);
        throw new BadRequestException('workerIds debe ser un array válido en la operación connect');
      }

      // ✅ PROCESAR CADA WORKER ID EN EL ARRAY
      for (const workerId of connectOp.workerIds) {
        // ✅ VALIDAR QUE EL ID SEA VÁLIDO
        if (!workerId || isNaN(Number(workerId))) {
          console.error('[OperationService] ID de trabajador inválido:', workerId);
          throw new BadRequestException(`ID de trabajador inválido: ${workerId}`);
        }

        console.log(`[OperationService] Procesando trabajador ID: ${workerId}`);

        try {
          // ✅ CREAR EL OBJETO PARA ASIGNAR TRABAJADOR
          const assignData = {
            id_operation: operationId,
            id_worker: Number(workerId),
            dateStart: connectOp.dateStart || null,
            dateEnd: connectOp.dateEnd || null,
            timeStart: connectOp.timeStart || null,
            timeEnd: connectOp.timeEnd || null,
            id_task: connectOp.id_task || null,
            id_subtask: connectOp.id_subtask || null,
            id_tariff: connectOp.id_tariff || null,
          };

          console.log(`[OperationService] Datos para asignar trabajador ${workerId}:`, assignData);

          // ✅ USAR EL SERVICIO DE ASIGNACIÓN EXISTENTE
          const assignResult = await this.operationWorkerService.assignWorkersToOperation(assignData);
          console.log(`[OperationService] Trabajador ${workerId} asignado exitosamente:`, assignResult);
        } catch (error) {
          console.error(`[OperationService] Error asignando trabajador ${workerId}:`, error);
          throw new BadRequestException(`Error asignando trabajador ${workerId}: ${error.message}`);
        }
      }
    }
  }

  // 3. ACTUALIZAR TRABAJADORES EXISTENTES
  if (workersOps.update && workersOps.update.length > 0) {
    console.log('[OperationService] ===== PROCESANDO UPDATE WORKERS =====');
    console.log('[OperationService] workersOps.update:', JSON.stringify(workersOps.update, null, 2));
    
    const workersToUpdate = workersOps.update
      .filter(updateOp => updateOp.id_worker && !isNaN(Number(updateOp.id_worker)))
      .map((updateOp: any) => {
        const mapped = {
          id_group: updateOp.id_group,
          workerIds: [Number(updateOp.id_worker)],
          id_task: updateOp.id_task,
          id_subtask: updateOp.id_subtask, // ✅ ASEGURAR QUE SE INCLUYA
          id_tariff: updateOp.id_tariff,
          dateStart: updateOp.dateStart,
          dateEnd: updateOp.dateEnd,
          timeStart: updateOp.timeStart,
          timeEnd: updateOp.timeEnd,
        };

        console.log(`[OperationService] Worker ${updateOp.id_worker} mapeado:`, {
          id_task: mapped.id_task,
          id_subtask: mapped.id_subtask, // ✅ LOG ESPECÍFICO
          id_tariff: mapped.id_tariff
        });

        return mapped;
      });

    console.log('[OperationService] ===== WORKERS PREPARADOS PARA ACTUALIZAR =====');
    workersToUpdate.forEach((worker, index) => {
      console.log(`Worker ${index + 1}:`, {
        id_group: worker.id_group,
        workerIds: worker.workerIds,
        id_task: worker.id_task,
        id_subtask: worker.id_subtask, // ✅ VERIFICAR QUE ESTÉ AQUÍ
        id_tariff: worker.id_tariff
      });
    });

    if (workersToUpdate.length > 0) {
      try {
        const updateResult = await this.operationWorkerService.updateWorkersSchedule(
          operationId,
          workersToUpdate
        );
        console.log('[OperationService] Resultado actualización:', updateResult);
      } catch (error) {
        console.error('[OperationService] Error actualizando trabajadores:', error);
        throw error;
      }
    }
  }
}

  // **AGREGAR EL MÉTODO PARA PROCESAR ENCARGADOS**
  private async processInChargedOperations(operationId: number, inChargedOps: any) {
    console.log('[OperationService] Procesando operaciones de encargados:', inChargedOps);

    // ✅ SIEMPRE ELIMINAR TODOS LOS ENCARGADOS EXISTENTES PRIMERO
    await this.prisma.inChargeOperation.deleteMany({
      where: { id_operation: operationId }
    });
    console.log('[OperationService] Eliminados todos los encargados existentes para la operación:', operationId);

    // Conectar nuevos encargados (si los hay)
    if (inChargedOps.connect && inChargedOps.connect.length > 0) {
      // ✅ FILTRAR DUPLICADOS ANTES DE CREAR
      const uniqueConnections = inChargedOps.connect.filter(
        (item, index, self) => index === self.findIndex(i => i.id === item.id)
      );

      console.log('[OperationService] Encargados únicos a conectar:', uniqueConnections);

      if (uniqueConnections.length > 0) {
        const dataToCreate = uniqueConnections.map((op: any) => ({
          id_operation: operationId,
          id_user: Number(op.id),
        }));

        try {
          const result = await this.prisma.inChargeOperation.createMany({
            data: dataToCreate,
            skipDuplicates: true,
          });
          
          console.log(`[OperationService] ${result.count} encargados conectados exitosamente`);
          console.log(`[OperationService] IDs conectados: ${uniqueConnections.map((op: any) => op.id).join(', ')}`);
        } catch (error) {
          console.error('[OperationService] Error creando encargados:', error);
          throw new BadRequestException('Error al asignar encargados a la operación');
        }
      }
    }

    // ✅ NO PROCESAR DISCONNECT PORQUE YA ELIMINAMOS TODOS AL INICIO
    // Esto simplifica la lógica y evita conflictos
  }
}
