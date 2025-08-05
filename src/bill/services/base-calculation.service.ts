import { Injectable } from '@nestjs/common';
import { HoursDistribution } from '../dto/create-bill.dto';

@Injectable()
export class BaseCalculationService {
  /**
   * Calcula el total de horas y montos basado en distribución de horas
   */
  calculateHoursByDistribution(
    group: any,
    hoursDistribution: HoursDistribution,
    tariff: number,
    useFacturationMultipliers: boolean = false
  ): { totalHours: number; totalAmount: number; details: any } {
    if (!tariff) {
      throw new Error(`El grupo ${group.groupId} no tiene tarifa definida`);
    }
  
    if (!group.hours) {
      throw new Error(`El grupo ${group.groupId} no tiene recargos definidos`);
    }
  
    let totalHours = 0;
    let totalAmount = 0;
    const hoursDetail = {};
  
    // Mapeo correcto de tipos de horas a claves de multiplicadores
    const hourTypeMapping = {
      'HOD': 'OD',
      'HON': 'ON', 
      'HED': 'ED',
      'HEN': 'EN',
      'HFOD': 'FOD',  // Mapear HFOD -> FOD
      'HFON': 'FON',  // Mapear HFON   -> FON
      'HFED': 'FED',  // Mapear HFED -> FED
      'HFEN': 'FEN'   // Mapear HFEN -> FEN
    };
  
    for (const [hourType, hours] of Object.entries(hoursDistribution)) {
      if (hours && hours > 0) {
        // Usar el mapeo correcto para obtener la clave del multiplicador
        const mappedHourType = hourTypeMapping[hourType];
        
        if (!mappedHourType) {
          console.warn(`Tipo de hora no reconocido: ${hourType}`);
          continue;
        }
  
        // Usar multiplicadores de facturación (FAC_) o nómina según el parámetro
        const multiplierKey = useFacturationMultipliers 
          ? `FAC_${mappedHourType}` 
          : mappedHourType;
  
  
        if (group.hours[multiplierKey]) {
          const hourAmount = hours * (group.workerCount || group.workers.length)* tariff * group.hours[multiplierKey];
          totalHours += hours;
          totalAmount += hourAmount;
  
          hoursDetail[hourType] = {
            hours,
            multiplier: group.hours[multiplierKey],
            amount: hourAmount,
          };
  
        } else {
          console.warn(`No se encontró multiplicador para ${multiplierKey}`);
        }
      }
    }
  
    console.log("Total calculado:", { totalHours, totalAmount });
  
    return {
      totalHours,
      totalAmount,
      details: {
        workerCount: group.workerCount,
        tariff,
        hoursDetail,
      },
    };
  }
  /**
   * Calcula el monto base (trabajadores * tarifa)
   */
  calculateBaseAmount(workerCount: number, tariff: number): number {
    return workerCount * tariff;
  }

  /**
   * Calcula el monto de horas compensatorias
   */
  calculateCompensatoryAmount(
    compensatoryHours: number,
    workerCount: number,
    tariff: number,
    baseHours: number
  ): number {
    return compensatoryHours * workerCount * baseHours * tariff;
  }


  
}