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
    allTaskIds,
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
    allTaskIds?: number[];
    inChargedIds?: number[];
  }) {
    try {
      // 1. Validar usuario si se proporciona

      let response: any = { succes: true };
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
        } else if (task) {
          response.task = task;
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
            id_site: true,
            id_subsite: true,
          },
        });
        const existingWorkerIds = existingWorkers.map((worker) => worker.id);
        const existingWorkerSitesAndSubsite = existingWorkers.map((worker) => ({
          id: worker.id,
          id_site: worker.id_site,
          id_subsite: worker.id_subsite,
        }));
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

        response.existingWorkerIds = existingWorkerSitesAndSubsite;
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
        if (operation) {
          response.operation = operation;
        }
        if (!operation) {
          return { message: 'Operation not found', status: 404 };
        }
      }

      // 11. Validar todas las tareas si se proporcionan IDs
      if (allTaskIds && allTaskIds.length > 0) {
        const existingTasks = await this.prisma.task.findMany({
          where: {
            id: {
              in: allTaskIds,
            },
          },
          select: {
            id: true,
            id_site: true,
            id_subsite: true,
            SubTask: { select: { id: true, name: true, id_task: true } },
          },
        });

        const existingTaskIds = existingTasks.map((task) => task.id);
        const existingTaskSitesAndSubsite = existingTasks.map((task) => ({
          id: task.id,
          id_site: task.id_site,
          id_subsite: task.id_subsite,
          subTask: task.SubTask,
        }));
        const nonExistingTaskIds = allTaskIds.filter(
          (taskId) => !existingTaskIds.includes(taskId),
        );

        if (nonExistingTaskIds.length > 0) {
          console.log('Tasks not found:', nonExistingTaskIds);
          return {
            message: `Tasks not found: ${nonExistingTaskIds.join(', ')}`,
            status: 404,
          };
        }

        response.existingTaskIds = existingTaskSitesAndSubsite;
      }
      return response;
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
    status,
  }: {
    id_clientProgramming?: number | null;
    service_request?: string;
    service?: string;
    dateStart?: string;
    timeStart?: string;
    client?: string;
    ubication?: string;
    status?: string;
  }) {
    try {
      // Verificar que la programación del cliente no exista
      if (
        service_request &&
        service &&
        dateStart &&
        timeStart &&
        client &&
        ubication
      ) {
        const existingProgramming =
          await this.prisma.clientProgramming.findFirst({
            where: {
              service_request,
              service,
              dateStart: new Date(dateStart || ''),
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

      if (service_request) {
        const serviceRequest = await this.prisma.clientProgramming.findFirst({
          where: { service_request },
        });
        if (serviceRequest) {
          return { message: 'Service alredy exists', status: 409 };
        }
      }

      // verificar si existe y tiene estado asignado
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
   *  Valida los IDs de trabajadores
   * @param workerIds
   * @returns
   */
  async validateWorkerIds(
    workerIds: number[],
    id_subsite?: number | null,
    id_site?: number | null,
  ) {
    if (!workerIds || !workerIds.length) return null;
    const validateIds = await this.validateAllIds({
      workerIds,
    });
    if (id_site && validateIds.existingWorkerIds) {
      const workersWithInvalidSite = validateIds.existingWorkerIds.filter(
        (worker) => worker.id_site !== id_site,
      );
      if (workersWithInvalidSite.length > 0) {
        const invalidWorkerIds = workersWithInvalidSite.map((w) => w.id);
        return {
          message: `Not access to workers with IDs site: ${invalidWorkerIds.join(
            ', ',
          )}`,
          status: 403,
        };
      }
    }
    return null;
  }

  /**
   * Valida que las SubTasks pertenezcan a las Tasks especificadas
   * @param taskSubTaskRelations - Array de objetos con id_task e id_subtask
   * @returns Validación de relaciones correctas
   */
  async validateTaskSubTaskRelations(
    taskSubTaskRelations: { id_task: number; id_subtask: number }[],
    id_site?: number | null,
  ) {
    try {
      if (!taskSubTaskRelations || taskSubTaskRelations.length === 0) {
        return { success: true };
      }

      // Obtener todas las tasks involucradas
      const taskIds = [
        ...new Set(taskSubTaskRelations.map((rel) => rel.id_task)),
      ];
      const subTaskIds = [
        ...new Set(taskSubTaskRelations.map((rel) => rel.id_subtask)),
      ];

      // Validar que todas las tasks existan con sus subtasks Y obtener su id_subsite
      const existingTasks = await this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          id_site: true,
          id_subsite: true,
          SubTask: {
            select: { id: true, name: true, id_task: true },
          },
        },
      });

      if (id_site) {
        const tasksWithDifferentSite = existingTasks.filter(
          (task) => task.id_site !== id_site,
        );

        if (tasksWithDifferentSite.length > 0) {
          const taskDetails = tasksWithDifferentSite.map((task) => ({
            taskId: task.id,
            taskSite: task.id_site,
            operationSite: id_site,
          }));

          return {
            message: 'All tasks must belong to the same Site as the operation',
            status: 400,
            details: `Found tasks from different Site: ${tasksWithDifferentSite.map((t) => t.id).join(', ')}`,
            taskSiteConflict: {
              id_site,
              taskDetails,
            },
          };
        }
      }

      const taskSubSites = existingTasks.map((task) => task.id_subsite);
      const uniqueSubSites = [...new Set(taskSubSites)];
      if (uniqueSubSites.length > 1) {
        const taskDetails = existingTasks.map((task) => ({
          taskId: task.id,
          subSite: task.id_subsite,
        }));

        return {
          message: 'All tasks in an operation must belong to the same SubSite',
          status: 400,
          details: `Found tasks from ${uniqueSubSites.length} different SubSites: ${uniqueSubSites.join(', ')}`,
          taskSubSiteConflict: {
            foundSubSites: uniqueSubSites,
            taskDetails: taskDetails,
          },
        };
      }
      // Crear mapa de subtasks por task (código original)
      const taskSubTaskMap = new Map();
      existingTasks.forEach((task) => {
        const subTaskIds = task.SubTask.map((st) => st.id);
        taskSubTaskMap.set(task.id, subTaskIds);
      });

      // Validar cada relación (código original)
      const invalidRelations: Array<{
        id_task: number;
        id_subtask: number;
        availableSubTasks: number[];
      }> = [];
      taskSubTaskRelations.forEach((relation) => {
        const validSubTaskIds = taskSubTaskMap.get(relation.id_task) || [];

        if (!validSubTaskIds.includes(relation.id_subtask)) {
          invalidRelations.push({
            id_task: relation.id_task,
            id_subtask: relation.id_subtask,
            availableSubTasks: validSubTaskIds,
          });
        }
      });

      if (invalidRelations.length > 0) {
        return {
          message: 'Invalid Task-SubTask relations found',
          status: 400,
          invalidRelations: invalidRelations,
          details: invalidRelations.map(
            (ir) =>
              `SubTask ${ir.id_subtask} does not belong to Task ${ir.id_task}. Available SubTasks: [${ir.availableSubTasks.join(', ')}]`,
          ),
        };
      }

      return {
        success: true,
        validatedRelations: taskSubTaskRelations,
        taskSubTaskMap: Object.fromEntries(taskSubTaskMap),
        validatedSubSite: uniqueSubSites[0],
      };
    } catch (error) {
      console.error('Error validating Task-SubTask relations:', error);
      throw new Error(`Error validating relations: ${error.message}`);
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

  /**
   * Valida que todos los trabajadores existan y devuelve su información de site/subsite
   * @param workerIds - Array de IDs de trabajadores
   * @returns Información de trabajadores existentes o error si no existen
   */
  async validateWorkersExistence(workerIds: number[]) {
    try {
      if (!workerIds || workerIds.length === 0) {
        return { success: true, existingWorkerIds: [] };
      }

      // Obtener todos los trabajadores con su información de site/subsite
      const existingWorkers = await this.prisma.worker.findMany({
        where: {
          id: {
            in: workerIds,
          },
        },
        select: {
          id: true,
          id_site: true,
          id_subsite: true,
        },
      });

      const existingWorkerIds = existingWorkers.map((worker) => worker.id);
      const existingWorkerSitesAndSubsite = existingWorkers.map((worker) => ({
        id: worker.id,
        id_site: worker.id_site,
        id_subsite: worker.id_subsite,
      }));

      const nonExistingWorkerIds = workerIds.filter(
        (workerId) => !existingWorkerIds.includes(workerId),
      );

      // Si hay trabajadores que no existen, devolver error
      if (nonExistingWorkerIds.length > 0) {
        console.log('Workers not found:', nonExistingWorkerIds);
        return {
          message: `Workers not found: ${nonExistingWorkerIds.join(', ')}`,
          status: 404,
          nonExistingWorkers: nonExistingWorkerIds,
        };
      }

      // Devolver la información de los trabajadores existentes
      return {
        success: true,
        existingWorkerIds: existingWorkerSitesAndSubsite,
      };
    } catch (error) {
      console.error('Error validating workers existence:', error);
      throw new Error(`Error validating workers: ${error.message}`);
    }
  }
}
