import { Injectable } from '@nestjs/common';
import { id } from 'date-fns/locale';

@Injectable()
export class OperationTransformerService {
  transformOperationResponse(operation) {
    if (!operation) return null;
    const { id_area, id_task, workers, inChargeOperation, ...rest } = operation;
    // Transformar trabajadores incluyendo el groupId
    const workersWithSchedule =
      workers?.map((w) => {
        return ({
        id: w.id_worker,
        name: w.worker.name,
        dni: w.worker.dni,
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
          id_tariff: w.tariff ? w.tariff.id : null,
          tariff: w.tariff ? w.tariff.subTask.name : null,
          code_tariff: w.tariff ? w.tariff.code : null,
          id_unit_of_measure: w.tariff ? w.tariff.unitOfMeasure.id : null,
          unit_of_measure: w.tariff ? w.tariff.unitOfMeasure.name : null,
          facturation_unit: w.tariff ? w.tariff.facturationUnit?.name : null,
          id_facturation_unit: w.tariff ? w.tariff.facturationUnit?.id : null
        },
      });
      }) || [];

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
        dni: workerData.dni,
      });
    });

    // Convertir el objeto en array
    return Object.values(groupedByGroupId);
  }
}
