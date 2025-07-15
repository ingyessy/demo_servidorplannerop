import { Injectable } from '@nestjs/common';

@Injectable()
export class OperationTransformerService {
  transformOperationResponse(operation) {
    if (!operation) return null;

    const { id_area, id_task, workers, inChargeOperation, ...rest } = operation;
    // Transformar trabajadores incluyendo el groupId
    const workersWithSchedule =
      workers?.map((w) => ({
        id: w.id_worker,
        name: w.worker.name,
        groupId: w.id_group, // Incluir el ID del grupo
        schedule: {
          dateStart: w.dateStart
            ? new Date(w.dateStart).toISOString().split('T')[0]
            : null,
          dateEnd: w.dateEnd
            ? new Date(w.dateEnd).toISOString().split('T')[0]
            : null,
          timeStart: w.timeStart || null,
          timeEnd: w.timeEnd || null,
          id_task: w.task ? w.task.id : null,
          task: w.task ? w.task.name : null,
        },
      })) || [];

    const inCharge =
      inChargeOperation?.map((ic) => ({
        id: ic.id_user,
        name: ic.user.name,
      })) || [];

    const workerGroups =
      this.groupWorkersByScheduleAndGroup(workersWithSchedule);

    return {
      ...rest,
      workerGroups,
      inCharge,
    };
  }

  /**
   * Agrupa trabajadores por horario y ID de grupo
   */
  groupWorkersByScheduleAndGroup(workers) {
    // Primero agrupar por ID de grupo
    const groupedByGroupId = {};

    workers.forEach((worker) => {
      const { groupId = 'default', ...workerData } = worker;

      if (!groupedByGroupId[groupId]) {
        groupedByGroupId[groupId] = {
          groupId,
          schedule: worker.schedule,
          workers: [],
        };
      }

      groupedByGroupId[groupId].workers.push({
        id: workerData.id,
        name: workerData.name,
      });
    });

    // Convertir el objeto en array
    return Object.values(groupedByGroupId);
  }
}
