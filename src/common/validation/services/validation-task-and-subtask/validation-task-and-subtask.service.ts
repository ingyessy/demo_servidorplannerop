import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ValidationTaskAndSubtaskService {
  constructor(private prisma: PrismaService) {}
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
}
