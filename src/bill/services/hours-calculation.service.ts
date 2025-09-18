import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigurationService } from 'src/configuration/configuration.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkerGroupSummary } from '../entities/worker-group-analysis.types';
import { GroupBillDto, HoursDistribution } from '../dto/create-bill.dto';
import { BaseCalculationService } from './base-calculation.service';
import { getDayNamesInRange, hasSundayInRange } from 'src/common/utils/dateType';

export interface ProcessHoursGroupsResult {
  groupId: string;
  site: string;
  subSite: string;
  task: string;
  code_tariff: string;
  tariff: string;
  week_number: number;
  workerCount: number;
  totalFinalFacturation: number;
  totalFinalPayroll: number;
  details: {
    factHoursDistribution: HoursDistributionResult;
    paysheetHoursDistribution: HoursDistributionResult;
    compensatoryBill: CompensatoryResult;
    compensatoryPayroll: CompensatoryResult;
  };
  workers: any[]; // Assuming this is an array of worker objects
}

export interface HoursDistributionResult {
  totalHours: number;
  totalAmount: number;
  details: {
    workerCount: number;
    tariff: number;
    hoursDetail: Record<string, HourDetail>;
  };
}

export interface HourDetail {
  hours: number;
  multiplier: number;
  amount: number;
}

export interface CompensatoryResult {
  hours: number;
  amount: number;
}

@Injectable()
export class HoursCalculationService {
  constructor(
    private prisma: PrismaService,
    private configurationService: ConfigurationService,
    private baseCalculationService: BaseCalculationService,
  ) {}

  /**
   * Determina las horas semanales límite basado en si hay domingo en el rango de fechas
   */
  private async getWeeklyHoursLimit(startDate: Date, endDate: Date): Promise<number> {
    const hasSunday = hasSundayInRange(startDate, endDate);
    
    if (hasSunday) {
      const sundayHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES_DOMINGO');
      if (sundayHoursConfig?.value) {
        return parseInt(sundayHoursConfig.value, 10);
      }
      return 48; // Valor por defecto para domingos
    } else {
      const weekHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES');
      if (weekHoursConfig?.value) {
        return parseInt(weekHoursConfig.value, 10);
      }
      return 44; // Valor por defecto para días normales
    }
  }

  /**
   * Determina si se debe calcular compensatorio basado en la fecha
   */
  private shouldCalculateCompensatory(startDate: Date, endDate: Date): boolean {
    return !hasSundayInRange(startDate, endDate);
  }

  async calculateCompensatoryHours(hours: number, startDate?: Date, endDate?: Date): Promise<number> {
    // Si se proporcionan fechas, verificar si hay domingo
    if (startDate && endDate && !this.shouldCalculateCompensatory(startDate, endDate)) {
      console.log('No se calcula compensatorio para operaciones con domingo');
      return 0;
    }

    const weekHours = startDate && endDate 
      ? await this.getWeeklyHoursLimit(startDate, endDate)
      : 44; // Fallback a valor por defecto

    const dayHours = weekHours / 6;

    if (hours > dayHours) {
      throw new ConflictException(`Las horas (${hours}) exceden el límite diario de ${dayHours} horas`);
    }

    const compensatoryHours = dayHours / 6 / (weekHours / 6);
    return compensatoryHours;
  }

  /**
   * Procesa grupos con unidad de medida HORAS
   */
  async processHoursGroups(
    groupSummary: WorkerGroupSummary,
    group: GroupBillDto,
  ): Promise<ProcessHoursGroupsResult> {
    const gfmt = groupSummary as any;
    const combinedGroupData = {
      ...groupSummary,
      billHoursDistribution: group.billHoursDistribution,
      paysheetHoursDistribution: group.paysheetHoursDistribution,
      amount: group.amount,
      pays: group.pays,
      hours: groupSummary.hours || gfmt.tariffDetails.hours,
      facturation_tariff: groupSummary.facturation_tariff || gfmt.tariffDetails.facturation_tariff,
      paysheet_tariff: groupSummary.paysheet_tariff || gfmt.tariffDetails.paysheet_tariff,
    };
   
    // Obtener fechas para validaciones
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (groupSummary.dateRange?.start && groupSummary.dateRange?.end) {
      startDate = toLocalDate(groupSummary.dateRange.start);
      endDate = toLocalDate(groupSummary.dateRange.end);

      console.log('=== ANÁLISIS DE FECHAS ===');
      console.log('startDate:', startDate.toISOString(), 'Día:', startDate.getDay());
      console.log('endDate:', endDate.toISOString(), 'Día:', endDate.getDay());

      const diasSemana = getDayNamesInRange(startDate, endDate);
      const tieneDomingo = hasSundayInRange(startDate, endDate);
      const horasLimite = await this.getWeeklyHoursLimit(startDate, endDate);
      
      console.log('Días de la semana en la operación:', diasSemana);
      console.log('¿Tiene domingo?', tieneDomingo);
      console.log('Horas límite semanales:', horasLimite);
      console.log('¿Calcular compensatorio?', this.shouldCalculateCompensatory(startDate, endDate));
      console.log('=== FIN ANÁLISIS FECHAS ===');
    }

    const result = await this.calculateHoursGroupResult(combinedGroupData, startDate, endDate);
    return result;
  }

  private async calculateHoursGroupResult(combinedGroupData: any, startDate?: Date | null, endDate?: Date | null) {
    // Calcular horas totales
    const totalBillHours =
      combinedGroupData.billHoursDistribution.HOD +
      combinedGroupData.billHoursDistribution.HON;
    const totalPaysheetHours =
      combinedGroupData.paysheetHoursDistribution.HOD +
      combinedGroupData.paysheetHoursDistribution.HON;

    // Calcular horas compensatorias (pasando las fechas)
    const compBill = await this.calculateCompensatoryHours(
      totalBillHours, 
      startDate || undefined, 
      endDate || undefined
    );
    const compPayroll = await this.calculateCompensatoryHours(
      totalPaysheetHours, 
      startDate || undefined, 
      endDate || undefined
    );

    // Calcular montos de distribución de horas - PASANDO LAS FECHAS
    const factHoursDistributionTotal =
      this.baseCalculationService.calculateHoursByDistribution(
        combinedGroupData,
        combinedGroupData.billHoursDistribution,
        combinedGroupData.facturation_tariff || combinedGroupData.tariffDetails.facturation_tariff,
        true, // usar multiplicadores FAC_
        startDate || undefined,
        endDate || undefined
      );

    console.log("Fact Hours Distribution Total--------------:", JSON.stringify(factHoursDistributionTotal, null, 2));

    const paysheetHoursDistributionTotal =
      this.baseCalculationService.calculateHoursByDistribution(
        combinedGroupData,
        combinedGroupData.paysheetHoursDistribution,
        combinedGroupData.paysheet_tariff  || combinedGroupData.tariffDetails.paysheet_tariff,
        false, // usar multiplicadores normales - AQUÍ SE APLICARÁ LA LÓGICA DE DOMINGO
        startDate || undefined,
        endDate || undefined
      );

    // Calcular montos compensatorios
    const totalCompBill =
      this.baseCalculationService.calculateCompensatoryAmount(
        compBill,
        combinedGroupData.workerCount,
        combinedGroupData.facturation_tariff,
        totalBillHours,
      );

    const totalCompPayroll =
      this.baseCalculationService.calculateCompensatoryAmount(
        compPayroll,
        combinedGroupData.workerCount,
        combinedGroupData.paysheet_tariff,
        totalPaysheetHours,
      );

    // Totales finales
    let totalFinalFacturation = factHoursDistributionTotal.totalAmount;
    let totalFinalPayroll = paysheetHoursDistributionTotal.totalAmount;
    
    // Solo agregar compensatorio si no hay domingo
    const shouldCalculateComp = startDate && endDate 
      ? this.shouldCalculateCompensatory(startDate, endDate)
      : true; // Por defecto calcular si no hay fechas

    if (combinedGroupData.compensatory === 'YES' && shouldCalculateComp) {
      totalFinalFacturation += totalCompBill;
      totalFinalPayroll += totalCompPayroll;
    }

    if (combinedGroupData.full_tariff === 'YES') {
      const sumHours = (
        Object.values(combinedGroupData.billHoursDistribution) as number[]
      ).reduce((a: number, b: number) => a + b, 0);
      totalFinalFacturation =
        combinedGroupData.facturation_tariff *
        sumHours *
        combinedGroupData.workerCount;
    }

    return {
      groupId: combinedGroupData.groupId,
      site: combinedGroupData.site,
      subSite: combinedGroupData.subSite,
      task: combinedGroupData.task,
      code_tariff: combinedGroupData.code_tariff,
      tariff: combinedGroupData.tariff,
      workerCount: combinedGroupData.workerCount,
      totalFinalFacturation,
      totalFinalPayroll,
      week_number: combinedGroupData.week_number,
      details: {
        factHoursDistribution: factHoursDistributionTotal,
        paysheetHoursDistribution: paysheetHoursDistributionTotal,
        compensatoryBill: { hours: compBill, amount: totalCompBill },
        compensatoryPayroll: { hours: compPayroll, amount: totalCompPayroll },
      },
      workers: combinedGroupData.workers || [],
    };
  }

  public async calculateAlternativeService(
    group: WorkerGroupSummary,
    groupBill: GroupBillDto,
  ) {
 
    // Nómina (paysheet)
    let paysheetTotal = 0;
    if (
      group.unit_of_measure !== 'HORAS' &&
      group.unit_of_measure !== 'JORNAL'
    ) {
      // Por cantidad (ej: cajas, toneladas)
      paysheetTotal = (groupBill.amount || 0) * (group.paysheet_tariff || 0);
    } else {
      // Lógica tradicional
      paysheetTotal = this.baseCalculationService.calculateHoursByDistribution(
        group,
        groupBill.paysheetHoursDistribution,
        group.paysheet_tariff || 0,
        false,
      ).totalAmount;
    }

    // Facturación
    let billingTotal = 0;
    if (group.group_tariff === 'YES') {
      billingTotal = groupBill.group_hours * (group.facturation_tariff || 0);
    } else if (
      group.facturation_unit !== 'HORAS' &&
      group.facturation_unit !== 'JORNAL'
    ) {
      billingTotal = (groupBill.amount || 0) * (group.facturation_tariff || 0);
    } else {
      billingTotal = this.baseCalculationService.calculateHoursByDistribution(
        group,
        groupBill.billHoursDistribution,
        group.facturation_tariff || 0,
        true,
      ).totalAmount;
    }

    return {
      paysheetTotal,
      billingTotal,
      groupId: group.groupId,
      workers: group.workers || [],
    };
  }
}

// Utilidad para convertir string 'YYYY-MM-DD' a fecha local
function toLocalDate(date: string | Date): Date {
  if (typeof date === 'string') {
    return new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10))
    );
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}