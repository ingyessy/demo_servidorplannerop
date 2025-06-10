import { Injectable } from '@nestjs/common';
import { StatusComplete } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ValidationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Valida que todos los IDs proporcionados existan en la base de datos
   * @param params - Objeto con los IDs y valores a validar
   * @returns Objeto con resultado de la validación (success: true) o mensaje de error
   */
  async validateAllIds({
    id_user,
    id_area,
    id_task,
    id_client,
    id_operation,
    code_worker,
    dni_worker,
    workerIds,
    inChargedIds,
    phone_worker,
  }: {
    id_user?: number;
    id_area?: number;
    id_task?: number;
    id_client?: number;
    id_operation?: number;
    dni_worker?: string;
    code_worker?: string;
    phone_worker?: string;
    workerIds?: number[];
    inChargedIds?: number[];
  }) {
    try {
      // 1. Validar usuario si se proporciona
      if (id_user !== undefined) {
        const user = await this.prisma.user.findUnique({
          where: { id: id_user },
        });

        if (!user) {
          return { message: 'User not found', status: 404 };
        }
      }

      // 2. Validar área si se proporciona
      if (id_area !== undefined) {
        const area = await this.prisma.jobArea.findUnique({
          where: { id: id_area },
        });

        if (!area) {
          return { message: 'Area not found', status: 404 };
        }
      }

      // 3. Validar tarea si se proporciona
      if (id_task !== undefined && id_task !== null) {
        const task = await this.prisma.task.findUnique({
          where: { id: id_task },
        });

        if (!task) {
          return { message: 'Task not found', status: 404 };
        }
      }

      // 4. Validar cliente si se proporciona
      if (id_client !== undefined) {
        const client = await this.prisma.client.findUnique({
          where: { id: id_client },
        });

        if (!client) {
          return { message: 'Client not found', status: 404 };
        }
      }

      // 5. Validar código si se proporciona
      if (code_worker !== undefined) {
        const existingWorkerWithCode = await this.prisma.worker.findUnique({
          where: { code: code_worker },
        });

        if (existingWorkerWithCode) {
          console.log(
            'Found existing worker with code:',
            existingWorkerWithCode.id,
          );
          return { message: 'Code already exists', status: 409 };
        }
      }

      // 6. Validar DNI si se proporciona
      if (dni_worker !== undefined) {
        const existingWorkerWithDNI = await this.prisma.worker.findUnique({
          where: { dni: dni_worker },
        });

        if (existingWorkerWithDNI) {
          console.log(
            'Found existing worker with DNI:',
            existingWorkerWithDNI.id,
          );
          return {
            message: 'Worker with this DNI already exists',
            status: 409,
          };
        }
      }

      // 7. Validar teléfono si se proporciona
      if (phone_worker !== undefined) {
        const existingWorkerWithPhone = await this.prisma.worker.findFirst({
          where: { phone: phone_worker },
        });

        if (existingWorkerWithPhone) {
          console.log(
            'Found existing worker with phone:',
            existingWorkerWithPhone.id,
          );
          return { message: 'Phone already exists', status: 409 };
        }
      }

      // 8. Validar que todos los trabajadores existan si se proporcionan IDs
      if (workerIds && workerIds.length > 0) {
        const existingWorkers = await this.prisma.worker.findMany({
          where: {
            id: {
              in: workerIds,
            },
          },
          select: {
            id: true,
          },
        });

        const existingWorkerIds = existingWorkers.map((worker) => worker.id);
        const nonExistingWorkerIds = workerIds.filter(
          (workerId) => !existingWorkerIds.includes(workerId),
        );

        if (nonExistingWorkerIds.length > 0) {
          console.log('Workers not found:', nonExistingWorkerIds);
          return {
            message: `Workers not found: ${nonExistingWorkerIds.join(', ')}`,
            status: 404,
          };
        }
      }

      // 9. Validar que todos los encargados existan si se proporcionan IDs
      if (inChargedIds && inChargedIds.length > 0) {
        const existingInCharged = await this.prisma.user.findMany({
          where: {
            id: {
              in: inChargedIds,
            },
          },
          select: {
            id: true,
          },
        });

        const existingInChargedIds = existingInCharged.map(
          (inChargedId) => inChargedId.id,
        );
        const nonExistingInChargedIds = inChargedIds.filter(
          (inChargedIds) => !existingInChargedIds.includes(inChargedIds),
        );

        if (nonExistingInChargedIds.length > 0) {
          console.log('InCharged not found:', nonExistingInChargedIds);
          return {
            message: `InCharged not found: ${nonExistingInChargedIds.join(', ')}`,
            status: 404,
          };
        }
      }

      // 10. Validar operación si se proporciona
      if (id_operation !== undefined) {
        const operation = await this.prisma.operation.findUnique({
          where: { id: id_operation },
        });

        if (!operation) {
          return { message: 'Operation not found', status: 404 };
        }
      }

      // Todos los IDs son válidos
      return { success: true };
    } catch (error) {
      console.error('Error validating IDs:', error);
      throw new Error(`Error validating IDs: ${error.message}`);
    }
  }

  /**
   * Validar si ya existe la programacion cliente
   * @param service_request - Solicitud de servicio
   * @param service - Servicio
   * @param dateStart - Fecha de inicio
   * @param timeStart - Hora de inicio
   * @param client - Cliente
   * @param ubication - Ubicación
   * @param id_operation - ID de la operación
   *
   */
   async validateClientProgramming({
    id_clientProgramming,
    service_request,
    service,
    dateStart,
    timeStart,
    client,
    ubication,
  }: {
    id_clientProgramming?: number | null;
    service_request?: string;
    service?: string;
    dateStart?: string | Date; 
    timeStart?: string;
    client?: string;
    ubication?: string;
  }) {
    try {
      // Verificar que la programación del cliente no exista (TODOS los campos deben coincidir)
      if (
        service_request &&
        service &&
        dateStart &&
        timeStart &&
        client &&
        ubication
      ) {
  
        let targetDate: Date;
  
        // Manejar tanto strings como objetos Date
        if (typeof dateStart === 'string') {
          if (dateStart.includes('-')) {
            // Formato "YYYY-MM-DD"
            const [year, month, day] = dateStart.split('-').map(Number);
            targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          } else {
            // Otros formatos de string
            targetDate = new Date(dateStart);
            targetDate.setHours(0, 0, 0, 0);
          }
        } else if (dateStart instanceof Date) {
          // Ya es un objeto Date
          targetDate = new Date(dateStart);
          targetDate.setHours(0, 0, 0, 0);
        } else {
          throw new Error('Invalid date format');
        }
        
  
        const existingProgramming = await this.prisma.clientProgramming.findFirst({
          where: {
            service_request,
            service,
            dateStart: targetDate,
            timeStart,
            client,
            ubication,
          },
        });
  
  
        if (existingProgramming) {
          return {
            message: 'Client programming already exists',
            status: 409,
          };
        }
      }
  
      // Verificar si el service_request ya existe (pero excluir el registro actual si estamos editando)
      if (service_request) {
        const serviceRequest = await this.prisma.clientProgramming.findFirst({
          where: { 
            service_request,
            // Si estamos editando, excluir el registro actual
            ...(id_clientProgramming && { id: { not: id_clientProgramming } })
          },
        });
        
        if (serviceRequest) {
          return { message: 'Service request already exists', status: 409 };
        }
      }
  
      // Verificar si existe y tiene estado asignado
      if (id_clientProgramming) {
        const validateId = await this.prisma.clientProgramming.findUnique({
          where: { id: id_clientProgramming },
        });
        
        if (!validateId) {
          return { message: 'Client programming not found', status: 404 };
        }
        
        const programming = await this.prisma.clientProgramming.findFirst({
          where: {
            id: id_clientProgramming,
            status: StatusComplete.ASSIGNED,
          },
        });
        
        if (programming) {
          return {
            message: 'Client programming already exists and is assigned',
            status: 409,
          };
        }
      }
  
      // Si no existe, se puede proceder con la creación
      return { success: true };
    } catch (error) {
      console.error('Error validating client programming:', error);
      throw new Error(`Error validating client programming: ${error.message}`);
    }
  }

  /**
   * Valida que un trabajador esté asignado a una operación
   * @param operationId - ID de la operación
   * @param workerId - ID del trabajador
   * @returns Objeto indicando si la relación existe o mensaje de error
   */
  async validateWorkerInOperation(operationId: number, workerId: number) {
    try {
      console.log('Validating worker in operation:', { operationId, workerId });

      // Verificar que la operación existe
      const operation = await this.prisma.operation.findUnique({
        where: { id: operationId },
      });

      if (!operation) {
        console.log('Operation not found:', operationId);
        return { message: 'Operation not found', status: 404 };
      }

      // Verificar que el trabajador existe
      const worker = await this.prisma.worker.findUnique({
        where: { id: workerId },
      });

      if (!worker) {
        console.log('Worker not found:', workerId);
        return { message: 'Worker not found', status: 404 };
      }

      // Verificar la relación entre trabajador y operación
      const relation = await this.prisma.operation_Worker.findFirst({
        where: {
          id_operation: operationId,
          id_worker: workerId,
        },
      });

      if (!relation) {
        console.log('Relation not found between operation and worker');
        return {
          message: `Worker ${workerId} is not assigned to operation ${operationId}`,
          status: 404,
        };
      }

      console.log('Worker is assigned to operation');
      return { success: true };
    } catch (error) {
      console.error('Error validating worker in operation:', error);
      throw new Error(
        `Error validating worker-operation relation: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si un código de trabajador ya existe
   * @param code - Código a verificar
   * @returns true si ya existe, false si no
   */
  async workerCodeExists(code: string): Promise<boolean> {
    try {
      const existingWorker = await this.prisma.worker.findUnique({
        where: { code },
      });
      return !!existingWorker;
    } catch (error) {
      console.error('Error checking if worker code exists:', error);
      throw new Error(`Error checking worker code: ${error.message}`);
    }
  }

  /**
   * Verifica si un DNI de trabajador ya existe
   * @param dni - DNI a verificar
   * @returns true si ya existe, false si no
   */
  async workerDniExists(dni: string): Promise<boolean> {
    try {
      const existingWorker = await this.prisma.worker.findUnique({
        where: { dni },
      });
      return !!existingWorker;
    } catch (error) {
      console.error('Error checking if worker DNI exists:', error);
      throw new Error(`Error checking worker DNI: ${error.message}`);
    }
  }

  /**
   * Verifica si un teléfono de trabajador ya existe
   * @param phone - Teléfono a verificar
   * @returns true si ya existe, false si no
   */
  async workerPhoneExists(phone: string): Promise<boolean> {
    try {
      const existingWorker = await this.prisma.worker.findFirst({
        where: { phone },
      });
      return !!existingWorker;
    } catch (error) {
      console.error('Error checking if worker phone exists:', error);
      throw new Error(`Error checking worker phone: ${error.message}`);
    }
  }
}
