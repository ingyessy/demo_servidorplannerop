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
        subTask: w.SubTask ? {
          id: w.SubTask.id,
          name: w.SubTask.name,
          code: w.SubTask.code
        }
        : null,
      });
      }) || [];

    // ✅ PROCESAR ENCARGADOS CON FILTRADO DE DUPLICADOS
    let inCharge: any[] = [];
    
    if (operation.inChargeOperation && Array.isArray(operation.inChargeOperation)) {
      inCharge = this.removeDuplicateInCharge(operation.inChargeOperation);
    } else if (operation.inCharge && Array.isArray(operation.inCharge)) {
      inCharge = this.removeDuplicateInCharge(operation.inCharge);
    }

    const workerGroups =
      this.groupWorkersByScheduleAndGroup(workersWithSchedule);

    return {
      ...rest,
      workerGroups,
      inCharge, // ✅ USAR LOS ENCARGADOS ÚNICOS
      // Remover la relación intermedia
      inChargeOperation: undefined
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
          subTask: worker.subTask,
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

  // ✅ AGREGAR MÉTODO PARA FILTRAR DUPLICADOS DE ENCARGADOS
  private removeDuplicateInCharge(inChargeData: any[]): any[] {
    if (!Array.isArray(inChargeData)) return [];
    
    // Usar Map para eliminar duplicados por ID de usuario
    const uniqueInCharge = new Map();
    
    inChargeData.forEach(item => {
      let userId, userData;
      
      // Manejar diferentes estructuras de datos
      if (item.user) {
        userId = item.user.id;
        userData = {
          id: item.user.id,
          name: item.user.name,
          occupation: item.user.occupation || null
        };
      } else if (item.id) {
        userId = item.id;
        userData = {
          id: item.id,
          name: item.name,
          occupation: item.occupation || null
        };
      }
      
      // Solo agregar si no existe ya
      if (userId && !uniqueInCharge.has(userId)) {
        uniqueInCharge.set(userId, userData);
      }
    });
    
    const result = Array.from(uniqueInCharge.values());
    // console.log('[OperationTransformer] inCharge originales:', inChargeData.length);
    // console.log('[OperationTransformer] inCharge únicos:', result.length);
    
    return result;
  }
}
