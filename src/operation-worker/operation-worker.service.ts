// src/operation-worker/operation-worker.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/validation/validation.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { RemoveWorkersDto } from './dto/remove-workers.dto';
import { WorkerScheduleDto } from './dto/worker-schedule.dto';

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
        in: workerId
      }
    }
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
    workersWithSchedule.forEach(group => {
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
    
    const currentWorkerIds = currentWorkers.map(worker => worker.id_worker);
    
    // 4. Filtrar los trabajadores que ya están asignados
    const simplesToAdd = allSimpleWorkerIds.filter(id => !currentWorkerIds.includes(id));
    
    // Para los trabajadores programados, necesitamos filtrar por grupo
    const scheduledGroupsToProcess: typeof workersWithSchedule = [];
    
    workersWithSchedule.forEach(group => {
      // Filtrar solo los IDs de trabajadores que no están asignados aún
      const filteredIds = group.workerIds.filter(id => !currentWorkerIds.includes(id));
      
      if (filteredIds.length > 0) {
        // Crear una copia del grupo con solo los trabajadores no asignados
        scheduledGroupsToProcess.push({
          ...group,
          workerIds: filteredIds
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
      const simpleAssignments = simplesToAdd.map(workerId =>
        this.prisma.operation_Worker.create({
          data: {
            id_operation,
            id_worker: workerId,
            dateStart: null,
            dateEnd: null,
            timeStart: null,
            timeEnd: null
          }
        })
      );
      assignmentPromises.push(...simpleAssignments);
    }
    
    // Asignar grupos de trabajadores con la misma programación
    if (scheduledGroupsToProcess.length > 0) {
      // Para cada grupo de trabajadores con programación
      scheduledGroupsToProcess.forEach(group => {
        // Preparar los datos de programación para este grupo
        const groupSchedule = {
          dateStart: group.dateStart ? parseDate(group.dateStart) : null,
          dateEnd: group.dateEnd ? parseDate(group.dateEnd) : null,
          timeStart: group.timeStart || null,
          timeEnd: group.timeEnd || null
        };
        
        // Crear una promesa de creación para cada trabajador en el grupo
        const groupAssignments = group.workerIds.map(workerId =>
          this.prisma.operation_Worker.create({
            data: {
              id_operation,
              id_worker: workerId,
              ...groupSchedule
            }
          })
        );
        
        assignmentPromises.push(...groupAssignments);
      });
    }
    
    // Ejecutar todas las asignaciones
    await Promise.all(assignmentPromises);
    
    // 6. Actualizar estado de los trabajadores asignados
    const allWorkersToUpdate = [
      ...simplesToAdd,
      ...scheduledGroupsToProcess.flatMap(g => g.workerIds)
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
        scheduled: scheduledGroupsToProcess
      }
    };
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
  /**
   * Actualiza la programación de trabajadores ya asignados a una operación
   * @param id_operation ID de la operación
   * @param workersToUpdate Array de trabajadores con su nueva programación
   * @returns Resultado de la actualización
   */
  async updateWorkersSchedule(id_operation: number, workersToUpdate: WorkerScheduleDto[]) {
    try {
      // Verificar que la operación existe
      const operation = await this.prisma.operation.findUnique({
        where: { id: id_operation },
      });
  
      if (!operation) {
        return { message: 'Operation not found', status: 404 };
      }
  
      // Función para convertir fechas
      const parseDate = (dateString) => {
        if (!dateString) return null;
        return new Date(dateString);
      };
  
      // Para cada grupo de trabajadores
      const updatePromises: Promise<any>[] = [];
      let updatedCount = 0;
  
      for (const group of workersToUpdate) {
        const { workerIds, dateStart, dateEnd, timeStart, timeEnd } = group;
        
        if (!workerIds || !Array.isArray(workerIds) || workerIds.length === 0) {
          continue;
        }
  
        // Buscar las asignaciones existentes para estos trabajadores
        const existingRecords = await this.findWorkerSchedule(id_operation, workerIds);
        
        // Para cada trabajador del grupo
        for (const workerId of workerIds) {
          // Encontrar su registro específico
          const existingRecord = existingRecords.find(record => record.id_worker === workerId);
          
          if (existingRecord) {
            // Aplicar actualizaciones preservando valores existentes si no se proporcionan nuevos
            
            const scheduleData = {
              dateStart: dateStart !== undefined ? (dateStart ? new Date(dateStart) : null) : existingRecord.dateStart,
              dateEnd: dateEnd !== undefined ? (dateEnd ? new Date(dateEnd) : null) : existingRecord.dateEnd,
              timeStart: timeStart !== undefined ? timeStart : existingRecord.timeStart,
              timeEnd: timeEnd !== undefined ? timeEnd : existingRecord.timeEnd
            };
            
            const updatePromise = this.prisma.operation_Worker.update({
              where: { id: existingRecord.id },
              data: scheduleData
            });
            
            updatePromises.push(updatePromise);
            updatedCount++;
          }
        }
      }
  
      // Ejecutar todas las actualizaciones
      await Promise.all(updatePromises);
  
      return { 
        message: `Updated schedule for ${updatedCount} workers in operation ${id_operation}`,
        updatedCount 
      };
    } catch (error) {
      console.error('Error updating workers schedule:', error);
      throw new Error(error.message);
    }
  }
}
