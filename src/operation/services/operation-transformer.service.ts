import { Injectable } from '@nestjs/common';

/**
 * Servicio para transformar datos de operaciones
 */
@Injectable()
export class OperationTransformerService {
  /**
   * Transforma un resultado de operación al formato de respuesta estándar
   * @param operation Operación a transformar
   * @returns Operación transformada
   */
  transformOperationResponse(operation) {
    if (!operation) return null;

    // Extraer propiedades no deseadas en la respuesta
    const { id_area, id_task, workers, inChargeOperation, ...rest } = operation;

    // Transformar trabajadores para incluir datos completos y programación
    const workersWithSchedule =
      workers?.map((w) => ({
        id: w.id_worker,
        schedule: {
          dateStart: w.dateStart
            ? new Date(w.dateStart).toISOString().split('T')[0]
            : null,
          dateEnd: w.dateEnd
            ? new Date(w.dateEnd).toISOString().split('T')[0]
            : null,
          timeStart: w.timeStart || null,
          timeEnd: w.timeEnd || null,
        },
      })) || [];

    // Transformar encargados
    const inCharge =
      inChargeOperation?.map((ic) => ({
        id: ic.id_user,
      })) || [];

    const workerGroups = this.groupWorkersBySchedule(workersWithSchedule);

    return {
      ...rest,
      //   workers: workersWithSchedule,
      workerGroups,
      inCharge,
    };
  }

  /**
   * Agrupa trabajadores por horario
   * @param workers - Lista de trabajadores con sus horarios
   * @returns Grupos de trabajadores por horario
   */
  groupWorkersBySchedule(workers) {
    // Crear un mapa de programaciones para agrupar trabajadores
    const scheduleGroups = {};

    workers.forEach((worker) => {
      // Crear una clave única para la programación
      const { schedule, ...workerData } = worker;
      const scheduleKey = JSON.stringify(schedule);

      if (!scheduleGroups[scheduleKey]) {
        scheduleGroups[scheduleKey] = {
          schedule: schedule,
          workers: [],
        };
      }

      scheduleGroups[scheduleKey].workers.push(workerData);
    });

    return Object.values(scheduleGroups);
  }
}
