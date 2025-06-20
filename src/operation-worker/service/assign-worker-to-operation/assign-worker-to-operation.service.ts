import { Injectable } from '@nestjs/common';
import { ValidationWorkerService } from 'src/common/validation/services/validation-worker/validation-worker.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { AssignWorkersDto } from 'src/operation-worker/dto/assign-workers.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AssignWorkerToOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
    private readonly validationWorkerService: ValidationWorkerService,
  ) {}
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
      workersWithSchedule.forEach((group) => {
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

        const validateWorkerIds =
          await this.validationWorkerService.validateWorkerIds(
            allWorkerIds,
            id_subsite,
            id_site,
          );
        if (validateWorkerIds?.status === 403) {
          return validateWorkerIds;
        }

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

      const currentWorkerIds = currentWorkers.map((worker) => worker.id_worker);

      // 4. Filtrar los trabajadores que ya están asignados
      const simplesToAdd = allSimpleWorkerIds.filter(
        (id) => !currentWorkerIds.includes(id),
      );

      // Para los trabajadores programados, necesitamos filtrar por grupo
      const scheduledGroupsToProcess: typeof workersWithSchedule = [];

      workersWithSchedule.forEach((group) => {
        // Filtrar solo los IDs de trabajadores que no están asignados aún
        const filteredIds = group.workerIds.filter(
          (id) => !currentWorkerIds.includes(id),
        );

        if (filteredIds.length > 0) {
          // Crear una copia del grupo con solo los trabajadores no asignados
          scheduledGroupsToProcess.push({
            ...group,
            workerIds: filteredIds,
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
        const simpleAssignments = simplesToAdd.map((workerId) =>
          this.prisma.operation_Worker.create({
            data: {
              id_operation,
              id_worker: workerId,
              dateStart: null,
              dateEnd: null,
              timeStart: null,
              timeEnd: null,
            },
          }),
        );
        assignmentPromises.push(...simpleAssignments);
      }

      // Asignar grupos de trabajadores con la misma programación
      if (scheduledGroupsToProcess.length > 0) {
        // Para cada grupo de trabajadores con programación
        scheduledGroupsToProcess.forEach((group) => {
          const groupId = group.id_group || uuidv4(); // Generar un ID único si no se proporciona
          const groupSchedule = {
            dateStart: group.dateStart ? parseDate(group.dateStart) : null,
            dateEnd: group.dateEnd ? parseDate(group.dateEnd) : null,
            timeStart: group.timeStart || null,
            timeEnd: group.timeEnd || null,
            id_group: groupId,
            id_task: group.id_task || null,
            id_subtask: group.id_subtask || null,
          };

          // Crear una promesa de creación para cada trabajador en el grupo
          const groupAssignments = group.workerIds.map((workerId) =>
            this.prisma.operation_Worker.create({
              data: {
                id_operation,
                id_worker: workerId,
                ...groupSchedule,
              },
            }),
          );

          assignmentPromises.push(...groupAssignments);
        });
      }

      // Ejecutar todas las asignaciones
      await Promise.all(assignmentPromises);

      // 6. Actualizar estado de los trabajadores asignados
      const allWorkersToUpdate = [
        ...simplesToAdd,
        ...scheduledGroupsToProcess.flatMap((g) => g.workerIds),
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
          scheduled: scheduledGroupsToProcess,
        },
      };
    } catch (error) {
      console.error('Error assigning workers to operation:', error);
      throw new Error(error.message);
    }
  }
}
