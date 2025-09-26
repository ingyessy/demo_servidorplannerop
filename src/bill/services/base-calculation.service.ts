import { Injectable } from '@nestjs/common';
import { HoursDistribution } from '../dto/create-bill.dto';
import { hasSundayInRange } from 'src/common/utils/dateType';

@Injectable()
export class BaseCalculationService {
  /**
   * Calcula el total de horas y montos basado en distribución de horas
   */
  calculateHoursByDistribution(
    group: any,
    hoursDistribution: HoursDistribution,
    tariff: number,
    useFacturationMultipliers: boolean = false,
    startDate?: Date,
    endDate?: Date
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
  
    // Detectar si hay domingo en el rango
    const hasSunday = startDate && endDate ? hasSundayInRange(startDate, endDate) : false;
    const weeklyHoursLimit = hasSunday ? 48 : 44;
    const dailyHoursLimit = weeklyHoursLimit / 6; // 8 horas para domingo, 7.33 para días normales
  
    // Mapeo correcto de tipos de horas a claves de multiplicadores
    const hourTypeMapping = {
      'HOD': 'OD',
      'HON': 'ON', 
      'HED': 'ED',
      'HEN': 'EN',
      'HFOD': 'FOD',  // Festiva Ordinaria Diurna
      'HFON': 'FON',  // Festiva Ordinaria Nocturna
      'HFED': 'FED',  // Festiva Extra Diurna
      'HFEN': 'FEN'   // Festiva Extra Nocturna
    };

    // Tipos de horas festivas
    const festivaHourTypes = ['HFOD', 'HFON', 'HFED', 'HFEN'];
  
    for (const [hourType, hours] of Object.entries(hoursDistribution)) {
      if (hours && hours > 0) {
        const mappedHourType = hourTypeMapping[hourType];
        if (!mappedHourType) {
          console.warn(`Tipo de hora no reconocido: ${hourType}`);
          continue;
        }
        const multiplierKey = useFacturationMultipliers 
          ? `FAC_${mappedHourType}` 
          : mappedHourType;

        // Solo calcular si existe el multiplicador
        if (typeof group.hours[multiplierKey] !== 'undefined') {
          let effectiveHours = hours;
          let specialMultiplier = group.hours[multiplierKey];
          let calculationType = 'normal';

          // LÓGICA ESPECIAL PARA DOMINGO - SOLO PARA NÓMINA Y HORAS FESTIVAS
          if (hasSunday && !useFacturationMultipliers && festivaHourTypes.includes(hourType)) {
            console.log(`\n=== CÁLCULO ESPECIAL DOMINGO PARA ${hourType} ===`);
            console.log(`Horas originales: ${hours}`);
            console.log(`Límite diario domingo: ${dailyHoursLimit} horas`);
            
            // Para domingo, las horas festivas se calculan con base en las 48 horas semanales
            // Pero el multiplicador puede cambiar según la lógica de negocio
            
            if (hourType === 'HFOD' || hourType === 'HFON') {
              // Horas festivas ordinarias en domingo: se calculan normalmente
              // pero con base en 48 horas semanales (8 horas diarias)
              calculationType = 'domingo_ordinaria';
              console.log(`Calculando ${hourType} como festiva ordinaria en domingo`);
            } 
            else if (hourType === 'HFED' || hourType === 'HFEN') {
              // Horas festivas extras en domingo: se calculan con base en el límite de 8 horas
              calculationType = 'domingo_extra';
              console.log(`Calculando ${hourType} como festiva extra en domingo`);
            }
            
            console.log(`Tipo de cálculo: ${calculationType}`);
            console.log(`Multiplicador aplicado: ${specialMultiplier}`);
            console.log(`=== FIN CÁLCULO DOMINGO ===\n`);
          }

          // Calcular el monto (las horas se mantienen, pero el contexto de cálculo cambia)
          const hourAmount = effectiveHours * (group.workerCount || group.workers.length) * tariff * specialMultiplier;
          totalHours += effectiveHours;
          totalAmount += hourAmount;
  
          hoursDetail[hourType] = {
            hours: effectiveHours,
            originalHours: hours,
            multiplier: specialMultiplier,
            amount: hourAmount,
            calculationType,
            isDomingoCalculation: hasSunday && !useFacturationMultipliers && festivaHourTypes.includes(hourType),
            weeklyLimit: weeklyHoursLimit,
            dailyLimit: dailyHoursLimit
          };

        } else {
          console.warn(`No se encontró multiplicador para ${multiplierKey} en grupo ${group.groupId}`);
          continue;
        }
      }
    }
  
    console.log("Total calculado:", { totalHours, totalAmount });
    
    if (hasSunday && !useFacturationMultipliers) {
      console.log("💡 Aplicado cálculo especial para horas festivas en domingo (nómina)");
    }
  
    return {
      totalHours,
      totalAmount,
      details: {
        workerCount: group.workerCount,
        tariff,
        hoursDetail,
        domingoCalculation: hasSunday && !useFacturationMultipliers,
        weeklyHoursLimit,
        dailyHoursLimit,
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
    return compensatoryHours * workerCount  * tariff; //* baseHours
  }
}