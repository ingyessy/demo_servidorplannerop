import { Injectable } from '@nestjs/common';
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
}