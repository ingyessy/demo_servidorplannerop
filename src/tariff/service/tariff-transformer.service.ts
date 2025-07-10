import { Injectable } from '@nestjs/common';

@Injectable()
export class TariffTransformerService {
  /**
   * Transforma la información de tarifa incluyendo todas sus relaciones
   * @param tariff Objeto tarifa con relaciones incluidas desde Prisma
   * @returns Objeto transformado con toda la información relevante
   */
  transformTariffResponse(tariff) {
    if (!tariff) return null;

    return {
      id: tariff.id,
      code: tariff.code,
      // Información de subtarea
      subTask: tariff.subTask ? {
        id: tariff.subTask.id,
        name: tariff.subTask.name,
        code: tariff.subTask.code,
        task: tariff.subTask.task ? {
          id: tariff.subTask.task.id,
          name: tariff.subTask.task.name
        } : null
      } : null,
      // Información de centro de costos
      costCenter: tariff.costCenter ? {
        id: tariff.costCenter.id,
        code: tariff.costCenter.code,
        name: tariff.costCenter.name,
        client: tariff.costCenter.client ? {
          id: tariff.costCenter.client.id,
          name: tariff.costCenter.client.name
        } : null,
        subSite: tariff.costCenter.subSite ? {
          id: tariff.costCenter.subSite.id,
          name: tariff.costCenter.subSite.name,
          site: tariff.costCenter.subSite.site ? {
            id: tariff.costCenter.subSite.site.id,
            name: tariff.costCenter.subSite.site.name
          } : null
        } : null
      } : null,
      // Información de unidad de medida
      unitOfMeasure: tariff.unitOfMeasure ? {
        id: tariff.unitOfMeasure.id,
        name: tariff.unitOfMeasure.name
      } : null,
      // Tarifas
      paysheet_tariff: parseFloat(tariff.paysheet_tariff),
      facturation_tariff: parseFloat(tariff.facturation_tariff),
      // Configuración
      full_tariff: tariff.full_tariff,
      compensatory: tariff.compensatory,
      hourly_paid_service: tariff.hourly_paid_service,
      agreed_hours: parseFloat(tariff.agreed_hours),
      // Horas
      hours: {
        OD: parseFloat(tariff.OD), // Ordinaria Diurna
        ON: parseFloat(tariff.ON), // Ordinaria Nocturna
        ED: parseFloat(tariff.ED), // Extra Diurna
        EN: parseFloat(tariff.EN), // Extra Nocturna
        FOD: parseFloat(tariff.FOD), // Festiva Ordinaria Diurna
        FON: parseFloat(tariff.FON), // Festiva Ordinaria Nocturna
        FED: parseFloat(tariff.FED), // Festiva Extra Diurna
        FEN: parseFloat(tariff.FEN),  // Festiva Extra Nocturna
        FAC_OD: parseFloat(tariff.FAC_OD), // FACTURA Ordinaria Diurna con recargo
        FAC_ON: parseFloat(tariff.FAC_ON), // FACTURA Ordinaria Nocturna con recargo
        FAC_ED: parseFloat(tariff.FAC_ED), // FACTURA Extra Diurna con recargo
        FAC_EN: parseFloat(tariff.FAC_EN), // FACTURA Extra Nocturna con recargo
        FAC_FOD: parseFloat(tariff.FAC_FOD), // FACTURA Festiva Ordinaria Diurna con recargo
        FAC_FON: parseFloat(tariff.FAC_FON), // FACTURA Festiva Ordinaria Nocturna con recargo
        FAC_FED: parseFloat(tariff.FAC_FED), // FACTURA Festiva Extra Diurna con recargo
        FAC_FEN: parseFloat(tariff.FAC_FEN)  // FACTURA Festiva Extra Nocturna con recargo
      },
      // Información adicional
      status: tariff.status,
      createdAt: tariff.createdAt,
      updatedAt: tariff.updatedAt,
      createdBy: tariff.user ? {
        id: tariff.user.id,
        name: tariff.user.name
      } : null
    };
  }

  /**
   * Transforma una lista de tarifas incluyendo todas sus relaciones
   * @param tariffs Lista de tarifas con relaciones incluidas
   * @returns Lista de tarifas transformadas
   */
  transformTariffListResponse(tariffs) {
    if (!tariffs || !Array.isArray(tariffs)) return [];
    
    return tariffs.map(tariff => this.transformTariffResponse(tariff));
  }

  /**
   * Transforma los datos de tarifa para incluirlos en la respuesta de operaciones
   * @param operationWorker Trabajador de operación con tarifa incluida
   * @returns Objeto con información de tarifa para incluir en operación
   */
  transformTariffForOperation(operationWorker) {
    if (!operationWorker || !operationWorker.tariff) return null;
    
    const { tariff } = operationWorker;
    
    return {
      id: tariff.id,
      code: tariff.code,
      subTask: tariff.subTask ? {
        id: tariff.subTask.id,
        name: tariff.subTask.name,
        code: tariff.subTask.code
      } : null,
      unitOfMeasure: tariff.unitOfMeasure ? {
        id: tariff.unitOfMeasure.id,
        name: tariff.unitOfMeasure.name
      } : null,
      paysheet_tariff: parseFloat(tariff.paysheet_tariff),
      facturation_tariff: parseFloat(tariff.facturation_tariff),
      full_tariff: tariff.full_tariff,
      compensatory: tariff.compensatory,
      hourly_paid_service: tariff.hourly_paid_service
    };
  }
}