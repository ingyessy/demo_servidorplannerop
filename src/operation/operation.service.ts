import { ConflictException, Injectable } from '@nestjs/common';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationWorkerService } from 'src/operation-worker/operation-worker.service';
import { StatusComplete, StatusOperation } from '@prisma/client';
import { OperationFinderService } from './services/operation-finder.service';
import { OperationRelationService } from './services/operation-relation.service';
import { OperationFilterDto } from './dto/fliter-operation.dto';
import { WorkerService } from 'src/worker/worker.service';

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
            message: 'Como SUPERVISOR solo puedes crear operaciones con máximo 48 horas de antigüedad.',
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
    (groups && groups.length > 0 && groups[0].id_task ? groups[0].id_task : null);

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

      // Prepare data to update
      const operationUpdateData = this.prepareOperationUpdateData(
        directFields,
        dateStart,
        dateEnd,
        timeStrat,
        timeEnd,
      );

      // Update operation
      await this.prisma.operation.update({
        where: { id },
        data: operationUpdateData,
      });

      // Handle status change
      if (directFields.status === StatusOperation.COMPLETED) {
        await this.workerService.addWorkedHoursOnOperationEnd(id); 
        await this.operationWorkerService.completeClientProgramming(id);
        await this.operationWorkerService.releaseAllWorkersFromOperation(id);
      }

      // Process relationship updates
      const res = await this.relationService.processRelationUpdates(
        id,
        workers,
        inCharged,
        id_site,
        id_subsite,
      );

      if (res !== undefined) {
        if (
          res.updated &&
          (res.updated.status === 404 ||
            res.updated.status === 403 ||
            res.updated.status === 400)
        ) {
          return res.updated;
        }
        if (res.status !== undefined && res.status !== 200) {
          return res;
        }
      }
      // Get updated operation
      const updatedOperation = await this.findOne(id);
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

    // Elimina campos no válidos para Prisma
  delete updateData.id_area;
  delete updateData.id_client;
  delete updateData.id_zone;
  delete updateData.id_clientProgramming;
  delete updateData.inChargedIds;
  delete updateData.workerIds;
  delete updateData.id_subsite;
  delete updateData.groups;
  // delete updateData.removedWorkerIds;
  // delete updateData.id;
  // delete updateData.originalWorkerIds;
  // delete updateData.updatedGroups;
  // delete updateData.workers;

   
   if (dateStart) updateData.dateStart = new Date(dateStart);
  if (dateEnd) {
    updateData.dateEnd = new Date(dateEnd);
  } else if (updateData.status === StatusOperation.COMPLETED) {
    updateData.dateEnd = new Date();
  }
  if (timeStrat) updateData.timeStrat = timeStrat;
  if (timeEnd) {
    updateData.timeEnd = timeEnd;
  } else if (updateData.status === StatusOperation.COMPLETED) {
    // Si se completa y no viene timeEnd, poner hora actual en formato HH:mm
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    updateData.timeEnd = `${hh}:${mm}`;
  }
  return updateData;
  }
  /**
   * Elimina una operación por su ID
   * @param id - ID de la operación a eliminar
   * @returns Operación eliminada
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
          where: { id_operation: id }
        });

        // 2. Eliminar encargados si existen
        try {
          await tx.inChargeOperation.deleteMany({
            where: { id_operation: id }
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
        where: { id_operation: id }
      });

      // 2. Eliminar InCharged
      try {
        await tx.inChargeOperation.deleteMany({
          where: { id_operation: id }
        });
      } catch (error) {
        // Continuar si la tabla no existe
      }

      // 3. Eliminar la operación
      return await tx.operation.delete({
        where: { id }
      });
    });
  }
}
