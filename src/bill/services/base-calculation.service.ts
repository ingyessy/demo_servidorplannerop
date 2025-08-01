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

    for (const [hourType, hours] of Object.entries(hoursDistribution)) {
      const normalizedHourType = hourType.startsWith('H')
        ? hourType.substring(1)
        : hourType;

      // Usar multiplicadores de facturación (FAC_) o nómina según el parámetro
      const multiplierKey = useFacturationMultipliers 
        ? `FAC_${normalizedHourType}` 
        : normalizedHourType;

      if (hours && hours > 0 && group.hours[multiplierKey]) {
        const hourAmount = hours * group.workerCount * tariff * group.hours[multiplierKey];
        totalHours += hours;
        totalAmount += hourAmount;

        hoursDetail[hourType] = {
          hours,
          multiplier: group.hours[multiplierKey],
          amount: hourAmount,
        };
      }
    }


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