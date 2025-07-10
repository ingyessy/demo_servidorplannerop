import { Injectable } from '@nestjs/common';
import { getDateType, DayType } from 'src/common/utils/dateType';
import {
  AdditionalHours,
  PayrollCalculationResult,
} from '../entities/worker-group-analysis.types';

@Injectable()
export class PayrollCalculationService {
  /**
   * Calcula el monto de nómina basado en grupo de trabajadores y horas adicionales
   * @param group Grupo de trabajadores
   * @param additionalHours Horas adicionales proporcionadas por el usuario
   * @param operationDate Fecha de la operación para determinar si es festivo/domingo
   * @returns Resultado del cálculo de nómina
   */
  calculatePayroll(
    group: any,
    additionalHours: AdditionalHours,
    operationDate: Date | string | null,
  ): PayrollCalculationResult {
    // Verificar si hay tarifa de nómina
    if (!group.paysheet_tariff) {
      throw new Error(
        `El grupo ${group.groupId} no tiene tarifa de nómina definida`,
      );
    }

    // Verificar si hay horas pactadas
    if (!group.agreed_hours) {
      throw new Error(
        `El grupo ${group.groupId} no tiene horas pactadas definidas`,
      );
    }

    // Verificar si hay recargos definidos
    if (!group.hours) {
      throw new Error(`El grupo ${group.groupId} no tiene recargos definidos`);
    }

    // Determinar si la fecha es festivo o domingo
    const dateInfo = operationDate
      ? getDateType(operationDate)
      : { type: DayType.NORMAL };
    const isHolidayOrSunday =
      dateInfo.type === DayType.HOLIDAY || dateInfo.type === DayType.SUNDAY;

    // 1. Cálculo base: trabajadores * tarifa nómina
    const baseAmount = group.workerCount * group.paysheet_tariff;

    // 2. Cálculo para horas adicionales
    let additionalHoursAmount = 0;
    const additionalHoursDetail = {};

    // Procesar cada tipo de hora adicional
    for (const [hourType, hours] of Object.entries(additionalHours)) {
      // Solo procesar horas que NO empiecen con FAC_
      if (hourType.startsWith('FAC_')) {
        continue; // Saltar esta hora si es de facturación
      }
      
      // Obtener el tipo de hora sin el prefijo "H" si existe
      const normalizedHourType = hourType.startsWith('H')
        ? hourType.substring(1)
        : hourType;

      // Verificar si hay horas y el multiplicador existe (usando el tipo normalizado)
      if (hours && hours > 0 && group.hours[normalizedHourType]) {
        const hourAmount =
          (group.paysheet_tariff / group.agreed_hours) *
          hours *
          group.hours[normalizedHourType];
        additionalHoursAmount += hourAmount;

        additionalHoursDetail[hourType] = {
          hours,
          multiplier: group.hours[normalizedHourType],
          amount: hourAmount,
        };
      }
    }

    // 3. Cálculo adicional si es festivo o domingo
    let holidayAmount = 0;
    let holidayMultiplier = 0;

    if (isHolidayOrSunday && group.hours.FOD) {
      holidayMultiplier = group.hours.FOD;
      holidayAmount = baseAmount * holidayMultiplier;
    }

    // 4. Cálculo total
    const totalAmount = baseAmount + additionalHoursAmount + holidayAmount;

    return {
      baseAmount,
      additionalHoursAmount,
      holidayAmount,
      totalAmount,
      details: {
        workerCount: group.workerCount,
        tariff: group.paysheet_tariff,
        isHolidayOrSunday,
        holidayMultiplier,
        additionalHoursDetail,
      },
    };
  }

  /**
   * Calcula el monto de facturación basado en grupo de trabajadores y horas adicionales
   * @param group Grupo de trabajadores
   * @param additionalHours Horas adicionales proporcionadas por el usuario
   * @param operationDate Fecha de la operación para determinar si es festivo/domingo
   * @returns Resultado del cálculo de facturación
   */
  calculateBilling(
    group: any,
    additionalHours: AdditionalHours,
    operationDate: Date | string | null,
  ): PayrollCalculationResult {
    // Verificar si hay tarifa de facturación
    if (!group.facturation_tariff) {
      throw new Error(
        `El grupo ${group.groupId} no tiene tarifa de facturación definida`,
      );
    }

    // Verificar si hay horas pactadas
    if (!group.agreed_hours) {
      throw new Error(
        `El grupo ${group.groupId} no tiene horas pactadas definidas`,
      );
    }

    // Verificar si hay recargos definidos
    if (!group.hours) {
      throw new Error(`El grupo ${group.groupId} no tiene recargos definidos`);
    }

    const dateInfo = operationDate
      ? getDateType(operationDate)
      : { type: DayType.NORMAL };
    const isHolidayOrSunday =
      dateInfo.type === DayType.HOLIDAY || dateInfo.type === DayType.SUNDAY;

    // 1. Cálculo base: trabajadores * tarifa facturación
    const baseAmount = group.workerCount * group.facturation_tariff;

    // 2. Cálculo para horas adicionales
    let additionalHoursAmount = 0;
    const additionalHoursDetail = {};

    for (const [hourType, hours] of Object.entries(additionalHours)) {
      // Para facturación, solo procesamos horas que comiencen con "FAC_"
      if (!hourType.startsWith('FAC_')) {
        continue; // Saltar esta hora si no comienza con FAC_
      }

      // Obtener el multiplicador correspondiente del objeto group.hours
      if (hours && hours > 0 && group.hours[hourType]) {
        const hourAmount =
          (group.facturation_tariff / group.agreed_hours) *
          hours *
          group.hours[hourType];
        additionalHoursAmount += hourAmount;

        additionalHoursDetail[hourType] = {
          hours,
          multiplier: group.hours[hourType],
          amount: hourAmount,
        };
      }
    }

    // 3. Cálculo adicional si es festivo o domingo
    let holidayAmount = 0;
    let holidayMultiplier = 0;

    // Para días festivos/domingos, usar el multiplicador FAC_FOD si existe
    if (isHolidayOrSunday && group.hours.FAC_FOD) {
      holidayMultiplier = group.hours.FAC_FOD;
      holidayAmount = baseAmount * (holidayMultiplier - 1); // El recargo festivo se aplica sobre el base
    }

    // 4. Cálculo total
    const totalAmount = baseAmount + additionalHoursAmount + holidayAmount;

    return {
      baseAmount,
      additionalHoursAmount,
      holidayAmount,
      totalAmount,
      details: {
        workerCount: group.workerCount,
        tariff: group.facturation_tariff,
        isHolidayOrSunday,
        holidayMultiplier,
        additionalHoursDetail,
      },
    };
  }

  /**
   * Calcula los totales de nómina y facturación para múltiples grupos
   * @param groups Lista de grupos de trabajadores
   * @param additionalHoursByGroup Horas adicionales por grupo (mapa de groupId -> horas)
   * @param operationDate Fecha de la operación
   * @returns Resultados de cálculos agregados
   */
  calculateTotals(
    groups: any[],
    additionalHoursByGroup: Record<string, AdditionalHours>,
    operationDate: Date | string | null,
  ) {
    let totalPayroll = 0;
    let totalBilling = 0;
    const groupResults: Array<{
      groupId: any;
      site: any;
      subSite: any;
      dateRange: any;
      timeRange: any;
      task: any;
      code_tariff: any;
      tariff: any;
      unit_of_measure: any;
      week_number?: number;
      workerCount: any;
      payroll: PayrollCalculationResult;
      billing: PayrollCalculationResult;
    }> = [];

    for (const group of groups) {
      // Obtener las horas adicionales para este grupo o usar un objeto vacío
      const additionalHours = additionalHoursByGroup[group.groupId] || {};

      try {
        // Calcular nómina para este grupo
        const payrollResult = this.calculatePayroll(
          group,
          additionalHours,
          operationDate,
        );
        totalPayroll += payrollResult.totalAmount;

        // Calcular facturación para este grupo
        const billingResult = this.calculateBilling(
          group,
          additionalHours,
          operationDate,
        );
        totalBilling += billingResult.totalAmount;
        // Guardar resultados para este grupo
        groupResults.push({
          groupId: group.groupId,
          site: group.site,
          subSite: group.subSite,
          dateRange: group.dateRange,
          timeRange: group.timeRange,
          week_number: group.week_number,
          task: group.task,
          code_tariff: group.code_tariff,
          tariff: group.tariff,
          unit_of_measure: group.unit_of_measure,
          workerCount: group.workerCount,
          payroll: payrollResult,
          billing: billingResult,
        });
      } catch (error) {
        console.error(
          `Error al calcular para el grupo ${group.groupId}:`,
          error.message,
        );
        // Continuar con el siguiente grupo
      }
    }

    return {
      totalPayroll,
      totalBilling,
      groupResults,
    };
  }
}
