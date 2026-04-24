import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateBillDto, GroupBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationFinderService } from 'src/operation/services/operation-finder.service';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { HoursCalculationService } from './services/hours-calculation.service';
import { ConfigurationService } from 'src/configuration/configuration.service';
import {
  getWeekNumber,
  hasSundayInRange,
  getDayName,
  toLocalDate,
} from 'src/common/utils/dateType';
import { BaseCalculationService } from './services/base-calculation.service';
import { Decimal } from '@prisma/client/runtime/library';
import { group } from 'console';
import { BillStatus, Status } from '@prisma/client';
import {
  getColombianDateTime,
  getColombianTimeString,
} from 'src/common/utils/dateColombia';
import { FilterBillDto } from './dto/filter-bill.dto';

type CreateBillOptions = {
  billStatus?: BillStatus;
  skipOperationCompletion?: boolean;
};

type CreateBillFromOperationOptions = CreateBillOptions & {
  mode?: 'NORMAL' | 'SPECIAL';
  workerGroupOverrides?: Array<{
    id_group?: string | null;
    number_of_hours?: number | null;
    group_hours?: number | Decimal | null;
  }>;
};

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);

  constructor(
    private prisma: PrismaService,
    private operationFinderService: OperationFinderService,
    private workerGroupAnalysisService: WorkerGroupAnalysisService,
    private payrollCalculationService: PayrollCalculationService,
    private hoursCalculationService: HoursCalculationService,
    private baseCalculationService: BaseCalculationService,
    private configurationService: ConfigurationService
  ) {}
  async create(
    createBillDto: CreateBillDto,
    userId: number,
    options: CreateBillOptions = {},
  ) {
    // console.log('=== [BillService] Iniciando creación de factura ===');
    // console.log('[BillService] userId:', userId);
    // console.log('[BillService] createBillDto:', JSON.stringify(createBillDto, null, 2));
    
    // ✅ VALIDAR QUE EXISTA id_operation
    if (!createBillDto.id_operation) {
      console.error('[BillService] ❌ Error: id_operation no proporcionado');
      throw new ConflictException('El ID de la operación es obligatorio para crear una factura');
    }

    // ✅ VALIDAR QUE EXISTAN GRUPOS
    if (!createBillDto.groups || createBillDto.groups.length === 0) {
      console.error('[BillService] ❌ Error: No se proporcionaron grupos');
      throw new ConflictException('La operación debe tener al menos un grupo de trabajadores para facturar');
    }

    for (const group of createBillDto.groups) {
      const paysSummary = (group.pays || []).map((pay) => ({
        id_worker: pay.id_worker,
        pay: pay.pay,
      }));
      this.logger.log(
        `[BillCreate][DTO] operation=${createBillDto.id_operation} group=${group.id || 'N/A'} amount=${group.amount ?? 'N/A'} number_of_hours=${group.number_of_hours ?? group.group_hours ?? 'N/A'} unit_type=${(group as any)?.unit_type ?? 'N/A'} pays=${JSON.stringify(paysSummary)}`,
      );
    }

    // console.log(`[BillService] ✅ Validación básica correcta: ${createBillDto.groups.length} grupos a procesar`);

    const validateOperationID = await this.validateOperation(
      createBillDto.id_operation,
    );
    if (validateOperationID['status'] === 404) {
      return validateOperationID;
    }

    // console.log('[BillService] ✅ Operación validada correctamente');

    const isSpecialOperation = await this.isSpecialOperationByTariff(
      createBillDto.id_operation,
    );
    const targetBillStatus =
      options.billStatus ??
      (isSpecialOperation ? ('TO_APPROVED' as BillStatus) : undefined);
    const shouldAutoCompleteOperation = !options.skipOperationCompletion;

    // Procesar todos los tipos de grupos
    await this.processJornalGroups(
      createBillDto,
      userId,
      validateOperationID,
      targetBillStatus,
    );
    await this.processSimpleHoursGroups(
      createBillDto,
      userId,
      validateOperationID,
      targetBillStatus,
    );
    await this.processAlternativeServiceGroups(
      createBillDto,
      userId,
      validateOperationID,
      targetBillStatus,
    );
    await this.processQuantityGroups(
      createBillDto,
      userId,
      validateOperationID,
      0,
      targetBillStatus,
    );

    // console.log('[BillService] ✅ Factura creada exitosamente');

    // ✅ COMPLETAR OPERACIÓN AUTOMÁTICAMENTE DESPUÉS DE GENERAR FACTURAS (flujo normal)
    if (shouldAutoCompleteOperation) {
      await this.completeOperationAfterBillCreation(createBillDto.id_operation);
    }

    return {
      message: 'Cálculos y guardado de facturación realizados con éxito',
    };
  }

  async createFromOperation(
    operationId: number,
    userId: number,
    options: CreateBillFromOperationOptions = {},
  ) {
    if (!operationId || operationId <= 0) {
      throw new ConflictException('El ID de la operación es obligatorio para crear una factura');
    }

    const mode = options.mode ?? 'SPECIAL';

    if (mode === 'SPECIAL') {
      const existingBills = await this.prisma.bill.count({
        where: { id_operation: operationId },
      });

      if (existingBills > 0) {
        this.logger.log(
          `La operación ${operationId} ya tiene ${existingBills} factura(s). Se omite creación automática de prefactura.`,
        );
        return {
          message: 'La operación ya tiene facturas creadas',
        };
      }
    }

    const createBillDto = await this.buildCreateBillDtoFromOperation(
      operationId,
      options.workerGroupOverrides,
    );

    const targetBillStatus =
      options.billStatus ??
      (mode === 'SPECIAL' ? ('TO_APPROVED' as BillStatus) : undefined);
    const skipOperationCompletion =
      options.skipOperationCompletion ?? mode === 'SPECIAL';

    return await this.create(createBillDto, userId, {
      billStatus: targetBillStatus,
      skipOperationCompletion,
    });
  }

  // Validar operación
  private async validateOperation(operationId: number) {
    const validateOperationID =
      await this.operationFinderService.getOperationWithDetailedTariffs(
        operationId,
      );

    if (!validateOperationID || validateOperationID.status === 404) {
      throw new NotFoundException('Operation not found');
    }

    // ✅ AGREGAR LOG PARA VERIFICAR QUE op_duration LLEGUE CORRECTAMENTE
    // console.log('=== VALIDATE OPERATION ===');
    // console.log('validateOperationID.op_duration:', validateOperationID.op_duration);
    // console.log('validateOperationID.workerGroups:', validateOperationID.workerGroups?.length);

    if (validateOperationID.workerGroups) {
      validateOperationID.workerGroups.forEach((group, index) => {
        // console.log(`Grupo ${index + 1} - op_duration:`, group.op_duration);
      });
    }
    // console.log('=== FIN VALIDATE OPERATION ===');

    return validateOperationID;
  }

  private async buildCreateBillDtoFromOperation(
    operationId: number,
    workerGroupOverrides?: Array<{
      id_group?: string | null;
      number_of_hours?: number | null;
      group_hours?: number | Decimal | null;
    }>,
  ): Promise<CreateBillDto> {
    const operationWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation: operationId,
        id_worker: { not: -1 },
      },
      select: {
        id_worker: true,
        id_group: true,
        id_tariff: true,
        dateStart: true,
        timeStart: true,
        dateEnd: true,
        timeEnd: true,
      },
    });

    if (!operationWorkers.length) {
      throw new ConflictException(
        `No se encontraron trabajadores/grupos para facturar la operación ${operationId}`,
      );
    }

    const uniqueGroups = [
      ...new Set(
        operationWorkers
          .map((ow) => ow.id_group)
          .filter((groupId): groupId is string => !!groupId),
      ),
    ];

    if (!uniqueGroups.length) {
      throw new ConflictException(
        `No se encontraron grupos válidos para facturar la operación ${operationId}`,
      );
    }

    const quantityByGroup = new Map<string, number>();
    for (const workerGroup of workerGroupOverrides || []) {
      if (!workerGroup.id_group) {
        continue;
      }

      const explicitQuantity =
        Number(workerGroup.number_of_hours ?? workerGroup.group_hours ?? 0) || 0;

      if (explicitQuantity > 0) {
        quantityByGroup.set(workerGroup.id_group, explicitQuantity);
      }
    }

    const tariffIds = [
      ...new Set(
        operationWorkers
          .map((ow) => ow.id_tariff)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];

    const tariffs = tariffIds.length
      ? await this.prisma.tariff.findMany({
          where: { id: { in: tariffIds } },
          select: {
            id: true,
            pay_units: true,
            unitOfMeasure: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

    const unitByTariffId = new Map<number, string>();
    const quantityByTariffId = new Map<number, number>();
    for (const tariff of tariffs) {
      unitByTariffId.set(
        tariff.id,
        (tariff.unitOfMeasure?.name || '').trim().toUpperCase(),
      );
      quantityByTariffId.set(tariff.id, Number(tariff.pay_units ?? 0));
    }

    const groups = uniqueGroups.map((groupId) => {
      const groupWorkers = operationWorkers.filter((ow) => ow.id_group === groupId);
      const representativeTariffId = groupWorkers.find(
        (ow) => typeof ow.id_tariff === 'number',
      )?.id_tariff;
      const unitName = representativeTariffId
        ? unitByTariffId.get(representativeTariffId)
        : '';
      const isTimeBasedUnit = unitName === 'HORAS' || unitName === 'JORNAL';
      const tariffQuantity = representativeTariffId
        ? Number(quantityByTariffId.get(representativeTariffId) ?? 0)
        : 0;
      const workerDurations = groupWorkers
        .map((ow) => {
          if (!ow.dateStart || !ow.timeStart || !ow.dateEnd || !ow.timeEnd) {
            return 0;
          }

          const start = new Date(ow.dateStart);
          const [sh, sm] = ow.timeStart.split(':').map(Number);
          start.setHours(sh, sm, 0, 0);

          const end = new Date(ow.dateEnd);
          const [eh, em] = ow.timeEnd.split(':').map(Number);
          end.setHours(eh, em, 0, 0);

          const diffHours = (end.getTime() - start.getTime()) / 3_600_000;
          return diffHours > 0 ? diffHours : 0;
        })
        .filter((hours) => hours > 0);

      const groupHours =
        workerDurations.length > 0
          ? Math.round(
              (workerDurations.reduce((sum, hours) => sum + hours, 0) /
                workerDurations.length) *
                100,
            ) / 100
          : 0;

      const explicitQuantity = quantityByGroup.get(groupId) || 0;
      const quantityForBilling = explicitQuantity > 0 ? explicitQuantity : tariffQuantity;

      if (!isTimeBasedUnit && quantityForBilling <= 0) {
        throw new ConflictException(
          `No se pudo determinar la cantidad para el grupo ${groupId} (unidad ${unitName || 'N/A'}). Envíe amount explícito o configure pay_units en la tarifa.`,
        );
      }

      const amountBase = isTimeBasedUnit
        ? groupHours > 0
          ? groupHours
          : 1
        : quantityForBilling > 0
          ? quantityForBilling
          : 1;

      const hoursDistributionBase = isTimeBasedUnit ? groupHours : 0;
      const numberOfHoursValue = isTimeBasedUnit
        ? groupHours
        : quantityForBilling > 0
          ? quantityForBilling
          : 1;

      this.logger.log(
        `[BillCreate][FromOperation][DTO] operation=${operationId} group=${groupId} unit=${unitName || 'N/A'} explicitQuantity=${explicitQuantity} tariffQuantity=${tariffQuantity} amount=${amountBase}`,
      );

      return {
        id: groupId,
        amount: amountBase,
        group_hours: new Decimal(groupHours),
        number_of_hours: numberOfHoursValue,
        pays: groupWorkers.map((ow) => ({
          id_worker: ow.id_worker,
          pay: 1,
        })),
        paysheetHoursDistribution: {
          HOD: hoursDistributionBase,
          HON: 0,
          HED: 0,
          HEN: 0,
          HFOD: 0,
          HFON: 0,
          HFED: 0,
          HFEN: 0,
        },
        billHoursDistribution: {
          HOD: hoursDistributionBase,
          HON: 0,
          HED: 0,
          HEN: 0,
          HFOD: 0,
          HFON: 0,
          HFED: 0,
          HFEN: 0,
        },
      };
    });

    return {
      id_operation: operationId,
      groups,
    };
  }

  // Procesar grupos JORNAL
  private async processJornalGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
    billStatus?: BillStatus,
  ) {
    const jornalGroups =
      await this.workerGroupAnalysisService.findGroupsByCriteria(
        validateOperationID.workerGroups,
        { unit_of_measure: 'JORNAL', alternative_paid_service: 'NO' },
      );

    const jornalGroupsFiltered = jornalGroups.filter((jg) =>
      createBillDto.groups.some((g) => String(g.id) === String(jg.groupId)),
    );

    // console.log('=== PROCESS JORNAL GROUPS DEBUG ===');
    // console.log(`Total grupos en la operación: ${jornalGroups.length}`);
    // console.log(`Grupos a facturar (del frontend): ${createBillDto.groups.length}`);
    // console.log(`IDs de grupos solicitados:`, createBillDto.groups.map(g => g.id));
    // console.log(`Grupos filtrados para facturar: ${jornalGroupsFiltered.length}`);
    // console.log(`IDs de grupos filtrados:`, jornalGroupsFiltered.map(g => g.groupId));

    if (jornalGroupsFiltered.length === 0) return;

    const operationDate = jornalGroups[0].dateRange.start;
    const calculationResults =
      this.payrollCalculationService.processJornalGroups(
        jornalGroupsFiltered,
        createBillDto.groups,
        operationDate,
      );

    for (const result of calculationResults.groupResults) {
      const groupDto = this.getGroupDto(createBillDto.groups, result.groupId);

      console.log(`\n--- Procesando grupo: ${result.groupId} ---`);
      console.log(`Workers en este grupo: ${result.workers?.length || 0}`);
      console.log(`Worker IDs:`, result.workers?.map(w => w.id) || []);
         
    // ✅ AGREGAR INFORMACIÓN DE LA OPERACIÓN AL RESULTADO
    result.operation = {
      dateStart: validateOperationID.dateStart,
      timeStrat: validateOperationID.timeStrat, // Usar el nombre real con typo
      dateEnd: validateOperationID.dateEnd,
      timeEnd: validateOperationID.timeEnd,
    };

      const billData = this.prepareBillData(
        result,
        createBillDto.id_operation,
        userId,
        groupDto,
      );
      const billSaved = await this.prisma.bill.create({
        data: this.withOptionalBillStatus(billData, billStatus),
      });
      
      console.log(`Bill creada con ID: ${billSaved.id} para grupo: ${result.groupId}`);

      await this.processBillDetails(
        result.workers,
        billSaved.id,
        createBillDto.id_operation,
        groupDto,
        result,
      );

      // ✅ Calcular automáticamente group_hours basándose en Operation_Worker
      await this.recalculateGroupHoursFromWorkerDates(
        createBillDto.id_operation,
        result.groupId,
      );
    }
  }

  // Procesar grupos HORAS (sin servicio alternativo)
  private async processSimpleHoursGroups(
  createBillDto: CreateBillDto,
  userId: number,
  validateOperationID: any,
  billStatus?: BillStatus,
) {
  const simpleHoursGroups =
    await this.workerGroupAnalysisService.findGroupsByCriteria(
      validateOperationID.workerGroups,
      {
        unit_of_measure: 'HORAS',
        alternative_paid_service: 'NO',
      },
    );

  const simpleHoursGroupsFiltered = simpleHoursGroups.filter((shg) =>
    createBillDto.groups.some((g) => String(g.id) === String(shg.groupId)),
  );

  if (simpleHoursGroupsFiltered.length === 0) return;

  // ✅ AGREGAR LOG PARA VERIFICAR op_duration DE LA OPERACIÓN
  // console.log('=== OPERACIÓN PRINCIPAL ===');
  // console.log('validateOperationID.op_duration:', validateOperationID.op_duration);

  for (const matchingGroupSummary of simpleHoursGroupsFiltered) {
    const group = createBillDto.groups.find(
      (g) =>
        String(g.id).trim() === String(matchingGroupSummary.groupId).trim(),
    );
    if (!group) continue;

    // ✅ VERIFICAR QUE op_duration ESTÉ EN EL SUMMARY
    // console.log('=== GRUPO INDIVIDUAL ===');
    // console.log('matchingGroupSummary.op_duration:', matchingGroupSummary.op_duration);

    const result = await this.hoursCalculationService.processHoursGroups(
      matchingGroupSummary,
      group,
    );
    
    const billData = this.prepareHoursBillData(
      result,
      createBillDto.id_operation,
      userId,
      group,
      matchingGroupSummary, // ✅ Agregar este parámetro
    );
    const billSaved = await this.prisma.bill.create({
      data: this.withOptionalBillStatus(
        {
          ...billData,
        },
        billStatus,
      ),
    });

    await this.processHoursBillDetails(
      matchingGroupSummary.workers,
      billSaved.id,
      createBillDto.id_operation,
      group,
      result,
    );

    // ✅ Calcular automáticamente group_hours basándose en Operation_Worker
    await this.recalculateGroupHoursFromWorkerDates(
      createBillDto.id_operation,
      matchingGroupSummary.groupId,
    );
  }
}

  // Procesar grupos con servicio alternativo
  private async processAlternativeServiceGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
    billStatus?: BillStatus,
  ) {
    const twoUnitsGroups =
      await this.workerGroupAnalysisService.findGroupsByCriteria(
        validateOperationID.workerGroups,
        { alternative_paid_service: 'YES' },
      );

    const twoUnitsGroupsFiltered = twoUnitsGroups.filter((tug) =>
      createBillDto.groups.some((g) => String(g.id) === String(tug.groupId)),
    );

    if (twoUnitsGroupsFiltered.length === 0) return;

    for (const matchingGroupSummary of twoUnitsGroupsFiltered) {
      const group = createBillDto.groups.find(
        (g) =>
          String(g.id).trim() === String(matchingGroupSummary.groupId).trim(),
      );
      if (!group) continue;

      const { totalFacturation, totalPaysheet } =
        await this.calculateAlternativeServiceTotals(
          matchingGroupSummary,
          group,
        );

      // // Calcular duración real del grupo
      // const groupDuration = await this.calcularDuracionGrupo(
      //   createBillDto.id_operation,
      //   group.id
      // );

      const billData = this.prepareAlternativeServiceBillData(
        matchingGroupSummary,
        group,
        totalFacturation,
        totalPaysheet,
        createBillDto.id_operation,
        userId,
      );

      const billSaved = await this.prisma.bill.create({
        data: this.withOptionalBillStatus(
          {
            ...billData,
            group_hours: group.group_hours ? Number(group.group_hours) : null,
          },
          billStatus,
        ),
      });

      await this.processAlternativeServiceBillDetails(
        matchingGroupSummary.workers,
        billSaved.id,
        createBillDto.id_operation,
        group,
        totalFacturation,
        totalPaysheet,
        matchingGroupSummary,
      );

      // ✅ Calcular automáticamente group_hours basándose en Operation_Worker
      await this.recalculateGroupHoursFromWorkerDates(
        createBillDto.id_operation,
        matchingGroupSummary.groupId,
      );
    }
  }
  private async calcularDuracionGrupo(
    id_operation: number,
    id_group: string | number,
  ): Promise<number> {
    const workersGrupo = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation,
        id_group: String(id_group),
      },
    });

    let totalHoras = 0;
    let count = 0;
    for (const w of workersGrupo) {
      if (w.dateStart && w.timeStart && w.dateEnd && w.timeEnd) {
        const start = new Date(w.dateStart);
        const [sh, sm] = w.timeStart.split(':').map(Number);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(w.dateEnd);
        const [eh, em] = w.timeEnd.split(':').map(Number);
        end.setHours(eh, em, 0, 0);
        const diff = (end.getTime() - start.getTime()) / 3_600_000;
        if (diff > 0) {
          totalHoras += diff;
          count++;
        }
      }
    }
    return count > 0 ? Math.round((totalHoras / count) * 100) / 100 : 0;
  }

  private async processQuantityGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
    amountDb: number,
    billStatus?: BillStatus,
  ) {
    // Si validateOperationID es un array de grupos, úsalo directamente
    const groupsSource = Array.isArray(validateOperationID.workerGroups)
      ? validateOperationID.workerGroups
      : validateOperationID;

    const quantityGroups = groupsSource.filter(
      (group) =>
        group.schedule?.unit_of_measure !== 'HORAS' &&
        group.schedule?.unit_of_measure !== 'JORNAL' &&
        group.schedule?.alternative_paid_service !== 'YES' &&
        // Acepta null o undefined en cualquiera de los dos campos
        (group.schedule?.id_facturation_unit === null ||
          group.schedule?.id_facturation_unit === undefined) &&
        (!group.tariffDetails?.facturationUnit ||
          group.tariffDetails?.facturationUnit === null),
    );

    const quantityGroupsFiltered = quantityGroups.filter((qg) =>
      createBillDto.groups.some((g) => String(g.id) === String(qg.groupId)),
    );

    if (quantityGroupsFiltered.length === 0) return;

    for (const group of createBillDto.groups) {
      const matchingGroupSummary = quantityGroupsFiltered.find(
        (summary) => summary.groupId === group.id
      );
      if (!matchingGroupSummary) continue;

      const paysSummary = (group.pays || []).map((pay) => ({
        id_worker: pay.id_worker,
        pay: pay.pay,
      }));
      this.logger.log(
        `[BillCreate][Quantity][DTO] operation=${createBillDto.id_operation} group=${group.id} unit=${matchingGroupSummary.schedule?.unit_of_measure || 'N/A'} amount=${group.amount ?? 'N/A'} number_of_hours=${group.number_of_hours ?? group.group_hours ?? 'N/A'} pays=${JSON.stringify(paysSummary)}`,
      );

      const { totalPaysheet, totalFacturation } = this.calculateQuantityTotals(
        matchingGroupSummary,
        group,
        amountDb,
      );

      // // Calcular duración real del grupo
      // const groupDuration = await this.calcularDuracionGrupo(
      //   createBillDto.id_operation,
      //   group.id
      // );

      const billData = this.prepareQuantityBillData(
        matchingGroupSummary,
        group,
        totalPaysheet,
        totalFacturation,
        createBillDto.id_operation,
        userId,
      );

      this.logger.log(
        `[BillCreate][Quantity][PrePersist] operation=${createBillDto.id_operation} group=${matchingGroupSummary.groupId} billData=${JSON.stringify({
          amount: billData.amount,
          number_of_hours: billData.number_of_hours,
          group_hours: billData.group_hours,
          total_bill: billData.total_bill,
          total_paysheet: billData.total_paysheet,
          number_of_workers: billData.number_of_workers,
        })}`,
      );

      const billSaved = await this.prisma.bill.create({
        data: this.withOptionalBillStatus(
          {
            ...billData,
          },
          billStatus,
        ),
      });

      const persistedBill = await this.prisma.bill.findUnique({
        where: { id: billSaved.id },
        select: {
          id: true,
          id_group: true,
          amount: true,
          number_of_hours: true,
          group_hours: true,
          total_bill: true,
          total_paysheet: true,
          status: true,
        },
      });

      this.logger.log(
        `[BillCreate][Quantity][Persisted] operation=${createBillDto.id_operation} group=${matchingGroupSummary.groupId} bill=${billSaved.id} values=${JSON.stringify(persistedBill)}`,
      );

      await this.processQuantityBillDetails(
        matchingGroupSummary.workers,
        billSaved.id,
        createBillDto.id_operation,
        group,
        totalPaysheet,
        totalFacturation,
        matchingGroupSummary,
      );

      // ✅ Calcular automáticamente group_hours basándose en Operation_Worker
      await this.recalculateGroupHoursFromWorkerDates(
        createBillDto.id_operation,
        matchingGroupSummary.groupId,
      );
    }
  }

  private withOptionalBillStatus<T extends Record<string, unknown>>(
    billData: T,
    billStatus?: BillStatus,
  ): T | (T & { status: BillStatus }) {
    if (!billStatus) {
      return billData;
    }

    return {
      ...billData,
      status: billStatus,
    };
  }

  // Calcular totales para servicio alternativo
  private async calculateAlternativeServiceTotals(
    matchingGroupSummary: any,
    group: GroupBillDto,
  ) {
    const facturationUnit =
      matchingGroupSummary.facturation_unit ||
      matchingGroupSummary.schedule.facturation_unit ||
      matchingGroupSummary.schedule.unit_of_measure;
    const facturationTariff =
      matchingGroupSummary.facturation_tariff ??
      matchingGroupSummary.tariffDetails?.facturation_tariff ??
      0;
    const paysheetUnit =
      matchingGroupSummary.unit_of_measure ??
      matchingGroupSummary.schedule.unit_of_measure;
    const paysheetTariff =
      matchingGroupSummary.paysheet_tariff ??
      matchingGroupSummary.tariffDetails?.paysheet_tariff ??
      0;

    let totalFacturation = 0;
    let totalPaysheet = 0;

    // Calcular facturación
    if (facturationUnit === 'HORAS' || facturationUnit === 'JORNAL') {
      if (matchingGroupSummary.group_tariff === 'YES') {
        const groupHoursNum = group.group_hours ? Number(group.group_hours) : 0;
        const factResult =
          groupHoursNum * (matchingGroupSummary.facturation_tariff ?? 0);
        totalFacturation = factResult;
      } else if (facturationUnit === 'HORAS') {
        const factResult =
          await this.hoursCalculationService.processHoursGroups(
            matchingGroupSummary,
            group,
          );
        totalFacturation = factResult.totalFinalFacturation;
      } else {
        const factResult = this.payrollCalculationService.processJornalGroups(
          [matchingGroupSummary],
          [group],
          matchingGroupSummary.dateRange.start,
        );
        totalFacturation = factResult.groupResults[0].billing.totalAmount;
      }
    } else {
      const amount = group.amount || 0;
      totalFacturation = amount * facturationTariff;
    }

    // Calcular nómina
    if (paysheetUnit === 'HORAS') {
      const paysheetResult =
        await this.hoursCalculationService.processHoursGroups(
          matchingGroupSummary,
          group,
        );
      totalPaysheet = paysheetResult.totalFinalPayroll;
      
      // ✅ AGREGAR COMPENSATORIO AL TOTAL PAYSHEET PARA TARIFA DE HORAS
      // Siempre se suma al total_paysheet cuando es por HORAS
      // Obtener datos necesarios para calcular compensatorio
      const workerCount = matchingGroupSummary.workers?.length || 0;
      const paysheetTariff = matchingGroupSummary.paysheet_tariff ?? 
                            matchingGroupSummary.tariffDetails?.paysheet_tariff ?? 0;
      const groupDuration = Number(group.group_hours) || 0;
      
      // Calcular horas de compensatorio
      const weekHours = 44; // valor por defecto
      const dayHours = weekHours / 6; // 7.333333 para 44 horas
      const compensatoryDay = dayHours / 6; // 1.222222 para 44 horas
      const compensatoryPerHour = compensatoryDay / dayHours; // compensatorio por hora
      const effectiveHours = Math.min(groupDuration, dayHours);
      const compensatoryHours = effectiveHours * compensatoryPerHour;
      const compensatoryAmount = compensatoryHours * workerCount * paysheetTariff;
      
      // Siempre sumar al total paysheet para servicios por HORAS
      totalPaysheet += compensatoryAmount;
    } else if (paysheetUnit === 'JORNAL') {
      const paysheetResult = this.payrollCalculationService.processJornalGroups(
        [matchingGroupSummary],
        [group],
        matchingGroupSummary.dateRange.start,
      );
      totalPaysheet = paysheetResult.groupResults[0].payroll.totalAmount;
    } else {
      const amount = group.amount || 0;
      totalPaysheet = amount * paysheetTariff;
      // console.log('Amount:', amount, 'Paysheet Tariff:', paysheetTariff);
    }

    return { totalFacturation, totalPaysheet };
  }

  // Calcular totales para grupos por cantidad
  private calculateQuantityTotals(
    matchingGroupSummary: any,
    group: GroupBillDto,
    amountDb: number,
  ) {
    const paysheetTariff =
      matchingGroupSummary.tariffDetails?.paysheet_tariff ?? 0;
    const facturationTariff =
      matchingGroupSummary.tariffDetails?.facturation_tariff ?? 0;
    const amount = group.amount ?? amountDb ?? 0;
    
    // ✅ LOG PARA DEPURACIÓN
    // console.log('=== CALCULATE QUANTITY TOTALS ===');
    // console.log('Grupo:', matchingGroupSummary.groupId);
    // console.log('paysheetTariff:', paysheetTariff);
    // console.log('facturationTariff:', facturationTariff);
    // console.log('amount:', amount);
    // console.log('totalPaysheet:', amount * paysheetTariff);
    // console.log('totalFacturation:', amount * facturationTariff);
    // console.log('=================================');
    
    return {
      totalPaysheet: amount * paysheetTariff,
      totalFacturation: amount * facturationTariff,
    };
  }

  private sanitizeBillAmount(amount: unknown, fallback: number = 0): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }

    return parsed;
  }

  // Obtener DTO de grupo
  private getGroupDto(groups: GroupBillDto[], groupId: string): GroupBillDto {
    const groupDto = groups.find((g) => g.id === groupId);
    if (!groupDto) {
      throw new ConflictException(`No se encontró el grupo con ID: ${groupId}`);
    }
    return groupDto;
  }

  // Preparar datos de facturación para grupos JORNAL
  private prepareBillData(
    result: any,
    operationId: number,
    userId: number,
    groupDto: GroupBillDto,
  ) {
    // ✅ OBTENER FECHAS CORRECTAS DE LA OPERACIÓN
    const operation = result.operation || result.operationData;

    // ✅ USAR FECHAS REALES DE LA OPERACIÓN (no calcular)
    const realDateStart = operation?.dateStart || result.dateStart;
    const realTimeStart = operation?.timeStrat || result.timeStart; // Nota: timeStrat (con typo) es el nombre real en BD
    const realDateEnd = operation?.dateEnd || result.dateEnd;
    const realTimeEnd = operation?.timeEnd || result.timeEnd;

    // ✅ CALCULAR DURACIÓN REAL BASADA EN FECHAS DE OPERACIÓN
    let realDuration = 0;
    if (realDateStart && realTimeStart && realDateEnd && realTimeEnd) {
      const start = new Date(realDateStart);
      const [sh, sm] = realTimeStart.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);

      const end = new Date(realDateEnd);
      const [eh, em] = realTimeEnd.split(':').map(Number);
      end.setHours(eh, em, 0, 0);

      realDuration =
        Math.round(
          ((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100,
        ) / 100;
    }
    const additionalHours = [
      groupDto.paysheetHoursDistribution.HED || 0,
      0,
      0,
      groupDto.paysheetHoursDistribution.HEN || 0,
      groupDto.paysheetHoursDistribution.HFED || 0,
      groupDto.paysheetHoursDistribution.HFEN || 0,
      0,
      0,
    ];

    return {
      week_number: result.week_number,
      id_operation: operationId,
      id_user: userId,
      amount: 0,
      number_of_workers: result.workerCount,
      total_bill: result.billing.totalAmount,
      total_paysheet: result.payroll.totalAmount,
      number_of_hours: additionalHours.reduce((sum, h) => sum + h, 0),
      createdAt: new Date(),
      HED: additionalHours[0],
      HON: additionalHours[1],
      HOD: additionalHours[2],
      HEN: additionalHours[3],
      HFED: additionalHours[4],
      HFEN: additionalHours[5],
      HFOD: additionalHours[6],
      HFON: additionalHours[7],
      FAC_HED: groupDto.billHoursDistribution.HED || 0,
      FAC_HON: 0,
      FAC_HOD: 0,
      FAC_HEN: groupDto.billHoursDistribution.HEN || 0,
      FAC_HFED: groupDto.billHoursDistribution.HFED || 0,
      FAC_HFEN: groupDto.billHoursDistribution.HFEN || 0,
      FAC_HFOD: 0,
      FAC_HFON: 0,
      observation: result?.observation || '',
      id_group: result.groupId,
    };
  }

  // Preparar datos para grupos HORAS
  private prepareHoursBillData(
    result: any,
    operationId: number,
    userId: number,
    groupDto: GroupBillDto,
    matchingGroupSummary?: any, // ✅ Nuevo parámetro opcional
  ) {

    // ✅ OBTENER FECHAS CORRECTAS DE LA OPERACIÓN
  const operation = result.operation || result.operationData;
  
  const realDateStart = operation?.dateStart || result.dateStart;
  const realTimeStart = operation?.timeStrat || result.timeStart;
  const realDateEnd = operation?.dateEnd || result.dateEnd;
  const realTimeEnd = operation?.timeEnd || result.timeEnd;

  // ✅ CALCULAR DURACIÓN REAL
  let realDuration = 0;
  if (realDateStart && realTimeStart && realDateEnd && realTimeEnd) {
    const start = new Date(realDateStart);
    const [sh, sm] = realTimeStart.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(realDateEnd);
    const [eh, em] = realTimeEnd.split(':').map(Number);
    end.setHours(eh, em, 0, 0);

    realDuration = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100;
  }

    // ✅ CALCULAR COMPENSATORIO PARA TARIFAS DE HORAS
    let totalFinalPayrollWithCompensatory = result.totalFinalPayroll;
    if (matchingGroupSummary) {
      // Siempre calcular compensatorio para servicios por HORAS
      // Obtener datos necesarios para calcular compensatorio
      const workerCount = matchingGroupSummary.workers?.length || result.workerCount || 0;
      const paysheetTariff = matchingGroupSummary.paysheet_tariff ?? 
                            matchingGroupSummary.tariffDetails?.paysheet_tariff ?? 0;
      const groupDuration = Number(groupDto.group_hours) || 0;
      
      // Calcular horas de compensatorio
      const weekHours = 44; // valor por defecto
      const dayHours = weekHours / 6; // 7.333333 para 44 horas
      const compensatoryDay = dayHours / 6; // 1.222222 para 44 horas
      const compensatoryPerHour = compensatoryDay / dayHours; // compensatorio por hora
      const effectiveHours = Math.min(groupDuration, dayHours);
      const compensatoryHours = effectiveHours * compensatoryPerHour;
      const compensatoryAmount = compensatoryHours * workerCount * paysheetTariff;
      
      // Siempre sumar al total paysheet para servicios por HORAS
      totalFinalPayrollWithCompensatory += compensatoryAmount;
    }

    return {
      week_number: result.week_number,
      id_operation: operationId,
      id_user: userId,
      amount: 0,
      number_of_workers: result.workerCount,
      total_bill: result.totalFinalFacturation,
      total_paysheet: totalFinalPayrollWithCompensatory, // ✅ Usar el valor con compensatorio
      number_of_hours: result.details.factHoursDistribution.totalHours,
      createdAt: new Date(),
      HED:
        result.details.paysheetHoursDistribution.details.hoursDetail['HED']
          ?.hours || 0,
      HON:
        result.details.paysheetHoursDistribution.details.hoursDetail['HON']
          ?.hours || 0,
      HOD:
        result.details.paysheetHoursDistribution.details.hoursDetail['HOD']
          ?.hours || 0,
      HEN:
        result.details.paysheetHoursDistribution.details.hoursDetail['HEN']
          ?.hours || 0,
      HFED:
        result.details.paysheetHoursDistribution.details.hoursDetail['HFED']
          ?.hours || 0,
      HFEN:
        result.details.paysheetHoursDistribution.details.hoursDetail['HFEN']
          ?.hours || 0,
      HFOD:
        result.details.paysheetHoursDistribution.details.hoursDetail['HFOD']
          ?.hours || 0,
      HFON:
        result.details.paysheetHoursDistribution.details.hoursDetail['HFON']
          ?.hours || 0,
      FAC_HED:
        result.details.factHoursDistribution.details.hoursDetail['HED']
          ?.hours || 0,
      FAC_HON:
        result.details.factHoursDistribution.details.hoursDetail['HON']
          ?.hours || 0,
      FAC_HOD:
        result.details.factHoursDistribution.details.hoursDetail['HOD']
          ?.hours || 0,
      FAC_HEN:
        result.details.factHoursDistribution.details.hoursDetail['HEN']
          ?.hours || 0,
      FAC_HFED:
        result.details.factHoursDistribution.details.hoursDetail['HFED']
          ?.hours || 0,
      FAC_HFEN:
        result.details.factHoursDistribution.details.hoursDetail['HFEN']
          ?.hours || 0,
      FAC_HFOD:
        result.details.factHoursDistribution.details.hoursDetail['HFOD']
          ?.hours || 0,
      FAC_HFON:
        result.details.factHoursDistribution.details.hoursDetail['HFON']
          ?.hours || 0,
      observation: groupDto.observation || '', // Agregar esta línea
      id_group: result.groupId,
    };
  }

  /**
   * Calcula el valor del compensatorio para una factura
   */
  private async calculateCompensatoryForBill(
    billDB: any,
    sundayHoursConfig?: any,
    weekHoursConfig?: any
  ): Promise<any> {
  try {
    // ✅ USAR group_hours EN LUGAR DE op_duration PARA EL COMPENSATORIO
    const groupDuration = Number(billDB.group_hours) || 0;
    // console.log('🔍 [calculateCompensatoryForBill] Usando group_hours:', {
    //   billId: billDB.id,
    //   groupHours: groupDuration,
    //   opDurationTotal: billDB.operation?.op_duration,
    //   diferencia: `El compensatorio usa ${groupDuration}h del grupo, NO ${billDB.operation?.op_duration}h de la operación total`
    // });
    
    if (groupDuration === 0) {
      return {
        hours: 0,
        amount: 0,
        percentage: 0,
        includeInTotal: false,
        error: 'No se encontró la duración del grupo (group_hours) o es 0',
      };
    }

    // Normalizar fechas usando la función de utilidades
    const startDate = billDB.operation?.dateStart
      ? toLocalDate(billDB.operation.dateStart)
      : undefined;
    const endDate = billDB.operation?.dateEnd
      ? toLocalDate(billDB.operation.dateEnd)
      : undefined;

    // console.log('🔍 [calculateCompensatoryForBill] Verificación de fechas:', {
    //   billId: billDB.id,
    //   dateStartRaw: billDB.operation?.dateStart,
    //   dateEndRaw: billDB.operation?.dateEnd,
    //   startDate: startDate?.toISOString().split('T')[0],
    //   endDate: endDate?.toISOString().split('T')[0],
    //   startDayOfWeek: startDate?.getDay(), // 0=domingo, 1=lunes, ...
    //   endDayOfWeek: endDate?.getDay(),
    // });

    // VERIFICAR SI HAY DOMINGO REAL
    let hasSundayReal = false;
    if (startDate && endDate) {
      hasSundayReal = hasSundayInRange(startDate, endDate);
      // console.log('🔍 [calculateCompensatoryForBill] Resultado verificación domingo:', {
      //   billId: billDB.id,
      //   hasSundayReal,
      //   fechaInicio: startDate.toISOString().split('T')[0],
      //   fechaFin: endDate.toISOString().split('T')[0],
      //   diaInicioSemana: startDate.getDay() === 0 ? 'DOMINGO' : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][startDate.getDay() - 1],
      //   diaFinSemana: endDate.getDay() === 0 ? 'DOMINGO' : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][endDate.getDay() - 1],
      // });
    }

    if (hasSundayReal) {
      return {
        hours: 0,
        amount: 0,
        percentage: 0,
        includeInTotal: false,
        info: 'No se calcula compensatorio porque hay domingo en el rango',
      };
    }

    // ✅ OBTENER FLAG DE COMPENSATORIO DE LA TARIFA
    const compensatoryFlag = billDB.billDetails?.[0]?.operationWorker?.tariff?.compensatory ?? 'NO';
    
    // ✅ USAR CONFIGURACIONES PASADAS COMO PARÁMETRO (optimización)
    let weekHours = 44; // valor por defecto
    if (startDate && endDate) {
      if (hasSundayReal && sundayHoursConfig?.value) {
        weekHours = parseInt(sundayHoursConfig.value, 10);
      } else if (!hasSundayReal && weekHoursConfig?.value) {
        weekHours = parseInt(weekHoursConfig.value, 10);
      }
    }

    // ✅ CÁLCULO CORRECTO DEL COMPENSATORIO
    const dayHours = weekHours / 6; // 7.333333 para 44 horas
    const compensatoryDay = dayHours / 6; // 1.222222 para 44 horas
    const compensatoryPerHour = compensatoryDay / dayHours; // compensatorio por hora
    
    // ✅ USAR DURACIÓN REAL DEL GRUPO, LIMITADA AL MÁXIMO DIARIO
    const effectiveHours = Math.min(groupDuration, dayHours);
    const compensatoryHours = effectiveHours * compensatoryPerHour;

    // console.log('📊 [Cálculo Compensatorio Detallado]:', {
    //   weekHours,
    //   dayHours,
    //   compensatoryDay,
    //   compensatoryPerHour,
    //   groupDuration: `${groupDuration}h (duración del GRUPO)`,
    //   effectiveHours,
    //   compensatoryHours: `${compensatoryHours}h (resultado final)`,
    //   nota: 'Ahora usa group_hours en lugar de op_duration'
    // });

    const workerCount = billDB.number_of_workers ?? 0;
    const tariff = billDB.billDetails?.[0]?.operationWorker?.tariff?.paysheet_tariff ?? 0;

    const compensatoryAmount = compensatoryHours * workerCount * tariff;

    // ✅ DETERMINAR SI EL COMPENSATORIO SE INCLUYE EN EL TOTAL BASÁNDOSE EN LA TARIFA
    const includeInTotal = compensatoryFlag === 'YES';

    return {
      hours: compensatoryHours,
      amount: compensatoryAmount,
      percentage: compensatoryHours > 0 
        ? (compensatoryAmount / billDB.total_paysheet) * 100 
        : 0,
      includeInTotal: includeInTotal,
      compensatoryFlag: compensatoryFlag,
      info: includeInTotal 
        ? 'Compensatorio incluido en total de facturación (tarifa compensatory: YES)'
        : 'Compensatorio mostrado pero NO incluido en total facturación (tarifa compensatory: NO)',
    };
  } catch (error) {
    console.error('Error en calculateCompensatoryForBill:', error);
    return {
      hours: 0,
      amount: 0,
      percentage: 0,
      includeInTotal: false,
      error: 'Error al calcular compensatorio',
    };
  }
}

  // Preparar datos para servicio alternativo
  private prepareAlternativeServiceBillData(
    matchingGroupSummary: any,
    group: GroupBillDto,
    totalFacturation: number,
    totalPaysheet: number,
    operationId: number,
    userId: number,
  ) {
    const facturationUnit =
      matchingGroupSummary.facturation_unit ||
      matchingGroupSummary.unit_of_measure;
    const paysheetUnit = matchingGroupSummary.unit_of_measure;
    const week_number = matchingGroupSummary.dateRange.start
      ? getWeekNumber(new Date(matchingGroupSummary.dateRange.start))
      : 0;

    const paysheetTotalHours = group.paysheetHoursDistribution
      ? Object.values(group.paysheetHoursDistribution).reduce(
          (acc: number, hours: number) => acc + hours,
          0,
        )
      : 0;
    const billTotalHours = group.billHoursDistribution
      ? Object.values(group.billHoursDistribution).reduce(
          (acc: number, hours: number) => acc + hours,
          0,
        )
      : 0;

    const numberHours = paysheetTotalHours || billTotalHours || 0;
    const normalizedAmount = this.sanitizeBillAmount(group.amount, 0);

    return {
      week_number: week_number || 0,
      id_operation: operationId,
      id_user: userId,
      amount: normalizedAmount,
      number_of_workers: matchingGroupSummary.workers?.length || 0,
      total_bill: totalFacturation,
      total_paysheet: totalPaysheet,
      number_of_hours: numberHours,
      group_hours: group.group_hours || numberHours || 0,
      createdAt: new Date(),
      HED: group.paysheetHoursDistribution?.HED || 0,
      HON: group.paysheetHoursDistribution?.HON || 0,
      HOD: group.paysheetHoursDistribution?.HOD || 0,
      HEN: group.paysheetHoursDistribution?.HEN || 0,
      HFED: group.paysheetHoursDistribution?.HFED || 0,
      HFEN: group.paysheetHoursDistribution?.HFEN || 0,
      HFOD: group.paysheetHoursDistribution?.HFOD || 0,
      HFON: group.paysheetHoursDistribution?.HFON || 0,
      FAC_HED: group.billHoursDistribution?.HED || 0,
      FAC_HON: group.billHoursDistribution?.HON || 0,
      FAC_HOD: group.billHoursDistribution?.HOD || 0,
      FAC_HEN: group.billHoursDistribution?.HEN || 0,
      FAC_HFED: group.billHoursDistribution?.HFED || 0,
      FAC_HFEN: group.billHoursDistribution?.HFEN || 0,
      FAC_HFOD: group.billHoursDistribution?.HFOD || 0,
      FAC_HFON: group.billHoursDistribution?.HFON || 0,
      observation: group.observation || '',
      id_group: matchingGroupSummary.groupId,
    };
  }

  // Preparar datos para grupos por cantidad
  private prepareQuantityBillData(
    matchingGroupSummary: any,
    group: GroupBillDto,
    totalPaysheet: number,
    totalFacturation: number,
    operationId: number,
    userId: number,
  ) {
    const week_number = getWeekNumber(matchingGroupSummary.schedule?.dateStart);
    const normalizedAmount = this.sanitizeBillAmount(group.amount, 0);
    const normalizedNumberOfHours =
      group.number_of_hours ?? group.group_hours ?? normalizedAmount;

    return {
      week_number: week_number || 0,
      id_operation: operationId,
      id_user: userId,
      amount: normalizedAmount,
      number_of_workers: matchingGroupSummary.workers?.length || 0,
      total_bill: totalFacturation,
      total_paysheet: totalPaysheet,
      number_of_hours: normalizedNumberOfHours,
      createdAt: new Date(),
      observation: group.observation || '',
      id_group: matchingGroupSummary.groupId,
      group_hours: group.group_hours || group.number_of_hours || 0,
    };
  }

  // Procesar detalles de facturación genérico
  private async processBillDetails(
    workers: any[],
    billId: number,
    operationId: number,
    groupDto: GroupBillDto,
    result: any,
  ) {
    // ✅ FILTRAR WORKERS ÚNICOS POR ID PARA EVITAR DUPLICACIÓN
    const uniqueWorkers = workers?.filter((worker, index, self) => 
      index === self.findIndex(w => w.id === worker.id)
    ) || [];

    console.log(`\n[processBillDetails] Bill ID: ${billId}, Grupo: ${groupDto.id}`);
    console.log(`Workers recibidos: ${workers?.length || 0}`);
    console.log(`Workers únicos: ${uniqueWorkers.length}`);

    if (workers?.length !== uniqueWorkers.length) {
      console.warn(
        `⚠️ [processBillDetails] Se encontraron ${workers.length - uniqueWorkers.length} workers duplicados. ` +
        `Total original: ${workers.length}, Únicos: ${uniqueWorkers.length}`
      );
      console.log('Workers originales:', workers?.map(w => w.id));
      console.log('Workers únicos:', uniqueWorkers.map(w => w.id));
    }

    let billDetailsCreated = 0;

    for (const worker of uniqueWorkers) {
      const operationWorker = await this.findOperationWorker(
        worker.id,
        operationId,
        groupDto.id,
      );

      console.log(`  → Creando billDetail para worker ${worker.id}, operation_worker: ${operationWorker.id}`);

      const totalPaysheetWorker = this.calculateTotalWorker(
        result.payroll.totalAmount,
        groupDto,
        worker,
        uniqueWorkers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        result.billing.totalAmount,
        groupDto,
        worker,
        uniqueWorkers,
      );

      const payWorker = groupDto.pays.find((p) => p.id_worker === worker.id);

      await this.createBillDetail({
        id_bill: billId,
        id_operation_worker: operationWorker.id,
        pay_rate: payWorker?.pay || 1,
        pay_unit: payWorker?.pay || 1,
        total_bill: totalFacturactionWorker,
        total_paysheet: totalPaysheetWorker,
      });

      billDetailsCreated++;
    }

    console.log(`[processBillDetails] Total billDetails creados: ${billDetailsCreated}\n`);
  }

  // Procesar detalles para grupos HORAS
  private async processHoursBillDetails(
    workers: any[],
    billId: number,
    operationId: number,
    group: GroupBillDto,
    result: any,
  ) {
    // ✅ FILTRAR WORKERS ÚNICOS POR ID PARA EVITAR DUPLICACIÓN
    const uniqueWorkers = workers?.filter((worker, index, self) => 
      index === self.findIndex(w => w.id === worker.id)
    ) || [];

    if (workers?.length !== uniqueWorkers.length) {
      console.warn(
        `⚠️ [processHoursBillDetails] Se encontraron ${workers.length - uniqueWorkers.length} workers duplicados. ` +
        `Total original: ${workers.length}, Únicos: ${uniqueWorkers.length}`
      );
    }

    for (const worker of uniqueWorkers) {
      const operationWorker = await this.findOperationWorker(
        worker.id,
        operationId,
        group.id,
      );
      const groupDto = this.getGroupDto([group], result.groupId);

      const totalPaysheetWorker = this.calculateTotalWorker(
        result.totalFinalPayroll,
        groupDto,
        worker,
        uniqueWorkers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        result.totalFinalFacturation,
        groupDto,
        worker,
        uniqueWorkers,
      );

      const payWorker = groupDto.pays.find((p) => p.id_worker === worker.id);

      await this.createBillDetail({
        id_bill: billId,
        id_operation_worker: operationWorker.id,
        pay_rate: payWorker?.pay || 1,
        pay_unit: payWorker?.pay || 1,
        total_bill: totalFacturactionWorker,
        total_paysheet: totalPaysheetWorker,
      });
    }
  }

  // Procesar detalles para servicio alternativo
  private async processAlternativeServiceBillDetails(
    workers: any[],
    billId: number,
    operationId: number,
    group: GroupBillDto,
    totalFacturation: number,
    totalPaysheet: number,
    matchingGroupSummary: any,
  ) {
    // ✅ FILTRAR WORKERS ÚNICOS POR ID PARA EVITAR DUPLICACIÓN
    const uniqueWorkers = workers?.filter((worker, index, self) => 
      index === self.findIndex(w => w.id === worker.id)
    ) || [];

    if (workers?.length !== uniqueWorkers.length) {
      console.warn(
        `⚠️ [processAlternativeServiceBillDetails] Se encontraron ${workers.length - uniqueWorkers.length} workers duplicados. ` +
        `Total original: ${workers.length}, Únicos: ${uniqueWorkers.length}`
      );
    }

    const facturationUnit =
      matchingGroupSummary.facturation_unit ||
      matchingGroupSummary.unit_of_measure;

    for (const worker of uniqueWorkers) {
      const operationWorker = await this.findOperationWorker(
        worker.id,
        operationId,
        group.id,
      );

      const totalPaysheetWorker = this.calculateTotalWorker(
        totalPaysheet,
        group,
        worker,
        uniqueWorkers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        totalFacturation,
        group,
        worker,
        uniqueWorkers,
      );

      const payWorker = group.pays?.find((p) => p.id_worker === worker.id);

      let payRate;
      if (facturationUnit !== 'HORAS' && facturationUnit !== 'JORNAL') {
        const totalUnitPays =
          group.pays?.reduce((sum, p) => sum + (p.pay || 0), 0) || 1;
        payRate = (group.amount / totalUnitPays) * (payWorker?.pay || 1);
      } else {
        payRate = payWorker?.pay || 1;
      }

      await this.createBillDetail({
        id_bill: billId,
        id_operation_worker: operationWorker.id,
        pay_rate: payRate,
        pay_unit: payWorker?.pay || 1,
        total_bill: totalFacturactionWorker,
        total_paysheet: totalPaysheetWorker,
      });
    }
  }

  // Procesar detalles para grupos por cantidad
  private async processQuantityBillDetails(
    workers: any[],
    billId: number,
    operationId: number,
    group: GroupBillDto,
    totalPaysheet: number,
    totalFacturation: number,
    matchingGroupSummary: any,
  ) {
    // ✅ FILTRAR WORKERS ÚNICOS POR ID PARA EVITAR DUPLICACIÓN
    const uniqueWorkers = workers?.filter((worker, index, self) => 
      index === self.findIndex(w => w.id === worker.id)
    ) || [];

    if (workers?.length !== uniqueWorkers.length) {
      console.warn(
        `⚠️ [processQuantityBillDetails] Se encontraron ${workers.length - uniqueWorkers.length} workers duplicados. ` +
        `Total original: ${workers.length}, Únicos: ${uniqueWorkers.length}`
      );
    }

    for (const worker of uniqueWorkers) {
      const operationWorker = await this.findOperationWorker(
        worker.id,
        operationId,
        group.id,
      );

      const totalUnitPays = group.pays.reduce(
        (sum, p) => sum + (p.pay || 0),
        0,
      );
      const payWorker = group.pays.find((p) => p.id_worker === worker.id);

      if (!payWorker) {
        throw new ConflictException(
          `No se encontró el pago para el trabajador con ID: ${worker.id}`,
        );
      }

      const payRate = (group.amount / totalUnitPays) * payWorker.pay;

      const totalWorkerPaysheet = this.calculateTotalWorker(
        totalPaysheet,
        group,
        worker,
        uniqueWorkers,
      );

      const totalWorkerFacturation = this.calculateTotalWorker(
        totalFacturation,
        group,
        worker,
        uniqueWorkers,
      );

      await this.createBillDetail({
        id_bill: billId,
        id_operation_worker: operationWorker.id,
        pay_rate: payRate,
        pay_unit: payWorker.pay || 1,
        total_bill: totalWorkerFacturation,
        total_paysheet: totalWorkerPaysheet,
      });
    }
  }

  // Funciones utilitarias reutilizables
// Funciones utilitarias reutilizables
  private async findOperationWorker(workerId: number, operationId: number, groupId?: string) {
    const whereClause: any = {
      id_worker: workerId,
      id_operation: operationId,
    };
    
    // ✅ CRÍTICO: Si se proporciona groupId, úsalo para diferenciar al mismo worker en diferentes grupos
    if (groupId) {
      whereClause.id_group = groupId;
      // console.log(`🔍 [findOperationWorker] Buscando worker ${workerId} en grupo ${groupId}`);
    } 
    // else {
    //   // console.warn(`⚠️ [findOperationWorker] ADVERTENCIA: Buscando worker ${workerId} SIN especificar grupo - puede devolver el worker incorrecto`);
    // }
    
    // ✅ Verificar si hay múltiples operation_workers para este worker
    const allMatches = await this.prisma.operation_Worker.findMany({
      where: {
        id_worker: workerId,
        id_operation: operationId,
      },
      select: {
        id: true,
        id_group: true,
      },
    });

    if (allMatches.length > 1) {
      console.log(`📊 [findOperationWorker] Worker ${workerId} existe en ${allMatches.length} grupos:`);
      allMatches.forEach(match => {
        console.log(`   - operation_worker ${match.id} en grupo ${match.id_group}${match.id_group === groupId ? ' ← SELECCIONADO' : ''}`);
      });
    }
    
    const operationWorker = await this.prisma.operation_Worker.findFirst({
      where: whereClause,
      include: {
        tariff: {
          include: {
            subTask: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            unitOfMeasure: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!operationWorker) {
      console.error(`❌ [findOperationWorker] No se encontró operation_worker para worker ${workerId} en operación ${operationId}${groupId ? ` y grupo ${groupId}` : ''}`);
      throw new ConflictException(
        `No se encontró el trabajador con ID: ${workerId} en operación ${operationId}${groupId ? ` y grupo ${groupId}` : ''}`,
      );
    }
    
    console.log(`✅ [findOperationWorker] Encontrado operation_worker ${operationWorker.id} para worker ${workerId} en grupo ${operationWorker.id_group}`);

    return operationWorker;
  }

  private async createBillDetail(data: any) {
    return await this.prisma.billDetail.create({ data });
  }

  // Función auxiliar para calcular el total_paysheet de cada trabajador
  private calculateTotalWorker(
    totalGroup: number,
    group: GroupBillDto,
    worker: any,
    workers: any[],
  ) {
    let payUnits = 1;
    if (Array.isArray(group.pays) && group.pays.length > 0) {
      payUnits = group.pays.reduce((sum, p) => sum + (p.pay || 0), 0);
    } else if (workers?.length) {
      payUnits = workers.length;
    }


    const payObj = Array.isArray(group.pays)
      ? group.pays.find((p) => p.id_worker === worker.id)
      : null;
    const individualPayment = payObj?.pay ?? 1;

    const totalWorker = (totalGroup / payUnits) * individualPayment

    return totalWorker;
  }
  async findAll(id_site?: number, id_subsite?: number | null) {
     const whereClause: any = {};

    // Si viene id_site, filtrar por sitio
    if (id_site) {
      whereClause.operation = {
        id_site: id_site,
      };
    }

    // Solo filtrar por subsede si es un número válido (no null ni undefined)
    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause.operation = {
        ...(whereClause.operation || {}),
        id_subsite: id_subsite,
      };
    }
    const bills = await this.prisma.bill.findMany({
      where: whereClause,
      
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        operation: {
          select: {
            id: true,
            dateStart: true,
            dateEnd: true,
            timeStrat: true,
            timeEnd: true,
            op_duration: true,
            motorShip: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            jobArea: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              select: {
                id: true,
                id_operation: true,
                id_worker: true,
                id_group: true,
                dateStart: true,
                dateEnd: true,
                timeStart: true,
                timeEnd: true,
                id_task: true,
                id_subtask: true,
                id_tariff: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    dni: true,
                  },
                },
                tariff: {
                  include: {
                    subTask: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // ✅ OPTIMIZACIÓN: Obtener configuraciones UNA SOLA VEZ
    const sundayHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES_DOMINGO');
    const weekHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES');
    
    // Calcular compensatorio para cada factura
    const billsWithCompensatory = await Promise.all(
      bills.map(async (bill) => {
        const compensatory = await this.calculateCompensatoryForBill(
          bill,
          sundayHoursConfig,
          weekHoursConfig
        );
        
        // ✅ OBTENER FECHAS DEL GRUPO
        const groupDates = await this.getGroupDatesFromOperationWorkers(
          bill.id_operation,
          bill.id_group,
        );

        return {
          ...bill,
          op_duration: bill.operation?.op_duration,
          compensatory,
          dateStart_group: groupDates.dateStart,
          timeStart_group: groupDates.timeStart,
          dateEnd_group: groupDates.dateEnd,
          timeEnd_group: groupDates.timeEnd,
        };
      }),
    );

    return billsWithCompensatory;
  }

  /**
   * Encuentra todas las bills filtradas por site y subsite
   * @param id_site - ID del site (opcional)
   * @param id_subsite - ID del subsite (opcional)
   * @returns Lista de bills filtradas con todas las relaciones
   */
  async findAllBySiteAndSubsite(id_site?: number, id_subsite?: number) {
    // Construir filtro dinámico basado en los parámetros
    const whereCondition: any = {};
    
    if (id_site !== undefined) {
      whereCondition.operation = {
        id_site: id_site,
      };
    }
    
    if (id_subsite !== undefined) {
      if (whereCondition.operation) {
        whereCondition.operation.id_subsite = id_subsite;
      } else {
        whereCondition.operation = {
          id_subsite: id_subsite,
        };
      }
    }

    const bills = await this.prisma.bill.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        operation: {
          select: {
            id: true,
            dateStart: true,
            dateEnd: true,
            timeStrat: true,
            timeEnd: true,
            op_duration: true,
            motorShip: true,
            id_site: true,
            id_subsite: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            jobArea: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              select: {
                id: true,
                id_operation: true,
                id_worker: true,
                id_group: true,
                dateStart: true,
                dateEnd: true,
                timeStart: true,
                timeEnd: true,
                id_task: true,
                id_subtask: true,
                id_tariff: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    dni: true,
                  },
                },
                tariff: {
                  include: {
                    subTask: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular compensatorio para cada factura
    const billsWithCompensatory = await Promise.all(
      bills.map(async (bill) => {
        const compensatory = await this.calculateCompensatoryForBill(bill);
        
        // ✅ OBTENER FECHAS DEL GRUPO
        const groupDates = await this.getGroupDatesFromOperationWorkers(
          bill.id_operation,
          bill.id_group,
        );

        return {
          ...bill,
          op_duration: bill.operation?.op_duration,
          compensatory,
          dateStart_group: groupDates.dateStart,
          timeStart_group: groupDates.timeStart,
          dateEnd_group: groupDates.dateEnd,
          timeEnd_group: groupDates.timeEnd,
        };
      }),
    );

    return billsWithCompensatory;
  }

  async findOne(id: number, id_site?: number, id_subsite?: number | null) {
    const whereClause: any = {id};

    // Si viene id_site, filtrar por sitio
    if (id_site) {
      whereClause.operation = {
        id_site: id_site,
      };
    }

    // Solo filtrar por subsede si es un número válido (no null ni undefined)
    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause.operation = {
        ...(whereClause.operation || {}),
        id_subsite: id_subsite,
      };
    }
    const billDB = await this.prisma.bill.findUnique({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        operation: {
          select: {
            id: true,
            dateStart: true,
            dateEnd: true,
            timeStrat: true,
            timeEnd: true,
            op_duration: true,
            motorShip: true,
            subSite: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            jobArea: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              select: {
                id: true,
                id_operation: true,
                id_worker: true,
                id_group: true,
                dateStart: true,
                dateEnd: true,
                timeStart: true,
                timeEnd: true,
                id_task: true,
                id_subtask: true,
                id_tariff: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    dni: true,
                  },
                },
                tariff: {
                  include: {
                    subTask: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!billDB) return null;

    // Calcular compensatorio
    const compensatory = await this.calculateCompensatoryForBill(billDB);

    // ✅ OBTENER FECHAS DEL GRUPO desde operation_worker
    const groupDates = await this.getGroupDatesFromOperationWorkers(
      billDB.id_operation,
      billDB.id_group,
    );

    // Mapeo para que la respuesta tenga la misma estructura que el DTO
    return {
      ...billDB,
      op_duration: billDB.operation?.op_duration,
      compensatory,
      // ✅ AGREGAR FECHAS DEL GRUPO
      dateStart_group: groupDates.dateStart,
      timeStart_group: groupDates.timeStart,
      dateEnd_group: groupDates.dateEnd,
      timeEnd_group: groupDates.timeEnd,
      billHoursDistribution: {
        HOD: billDB.HOD,
        HON: billDB.HON,
        HED: billDB.HED,
        HEN: billDB.HEN,
        HFOD: billDB.HFOD,
        HFON: billDB.HFON,
        HFED: billDB.HFED,
        HFEN: billDB.HFEN,
      },
      paysheetHoursDistribution: {
        HOD: billDB.FAC_HOD,
        HON: billDB.FAC_HON,
        HED: billDB.FAC_HED,
        HEN: billDB.FAC_HEN,
        HFOD: billDB.FAC_HFOD,
        HFON: billDB.FAC_HFON,
        HFED: billDB.FAC_HFED,
        HFEN: billDB.FAC_HFEN,
      },
      pays: billDB.billDetails.map((detail) => ({
        id_worker: detail.operationWorker.worker.id,
        pay: detail.pay_unit,
        pay_rate: detail.pay_rate,
      })),
    };
  }

  async update(id: number, updateBillDto: UpdateBillDto, userId: number) {
    // console.log('[BillService] 🔧 Update Bill - Parámetros recibidos:');
    // console.log('- ID Bill:', id);
    // console.log('- Update DTO:', JSON.stringify(updateBillDto, null, 2));
    // console.log('- User ID:', userId);

    const existingBill = await this.prisma.bill.findUnique({ where: { id } });
    if (!existingBill) {
      throw new ConflictException(`No se encontró la factura con ID: ${id}`);
    }

    const billDb = await this.prisma.bill.findUnique({
      where: { id },
    });

    if (!billDb) {
      throw new ConflictException(`No se encontró la factura con ID: ${id}`);
    }

    // Normalizar payload: algunos clientes envían formato de creación ({ groups: [...] })
    // al endpoint PATCH /bill/:id. En ese caso, tomamos el primer grupo.
    const rawPayload = updateBillDto as UpdateBillDto & {
      groups?: GroupBillDto[];
    };
    const nestedGroup = Array.isArray(rawPayload.groups)
      ? rawPayload.groups[0]
      : undefined;

    const normalizedUpdateBillDto: UpdateBillDto = nestedGroup
      ? {
          ...rawPayload,
          ...nestedGroup,
        }
      : updateBillDto;

    this.logger.log(
      `[BillUpdate][IN] bill=${id} user=${userId} hasNestedGroups=${Array.isArray(rawPayload.groups)} nestedCount=${rawPayload.groups?.length || 0} root_amount=${(updateBillDto as any)?.amount ?? 'N/A'} normalized_amount=${(normalizedUpdateBillDto as any)?.amount ?? 'N/A'}`,
    );

    if (Array.isArray(rawPayload.groups) && rawPayload.groups.length > 0) {
      const groupsSummary = rawPayload.groups.map((group) => ({
        id: group?.id || 'N/A',
        amount: (group as any)?.amount,
        number_of_hours: (group as any)?.number_of_hours,
        group_hours: (group as any)?.group_hours,
        pays_count: Array.isArray((group as any)?.pays)
          ? (group as any).pays.length
          : 0,
      }));
      this.logger.log(
        `[BillUpdate][IN_GROUPS] bill=${id} detail=${JSON.stringify(groupsSummary)}`,
      );
    }

    // ✅ MANEJAR ACTUALIZACIÓN DE FECHAS DEL GRUPO
    const shouldUpdateGroupDates = !!(
      normalizedUpdateBillDto.dateStart_group ||
      normalizedUpdateBillDto.timeStart_group ||
      normalizedUpdateBillDto.dateEnd_group ||
      normalizedUpdateBillDto.timeEnd_group
    );

    // ✅ USAR EL id_group DE LA BILL EXISTENTE SI NO SE PROPORCIONA EN EL DTO
    const groupId = normalizedUpdateBillDto.id || billDb.id_group;
    
    if (!groupId) {
      throw new ConflictException('No se pudo determinar el ID del grupo para actualizar');
    }

    if (shouldUpdateGroupDates) {
      // console.log(`[BillService] 📅 Actualizando fechas del grupo ${groupId} para Bill ${id}`);
      
      // Actualizar las fechas de todos los operation_worker de este grupo
      await this.updateOperationWorkerDates(
        billDb.id_operation,
        groupId,
        normalizedUpdateBillDto.dateStart_group,
        normalizedUpdateBillDto.timeStart_group,
        normalizedUpdateBillDto.dateEnd_group,
        normalizedUpdateBillDto.timeEnd_group,
      );

      // Actualizar los campos de fecha del grupo en la Bill (cuando estén en el schema)
      // await this.updateBillGroupDates(id, updateBillDto, userId);
    }

    const validateOperationID = await this.validateOperation(
      billDb.id_operation,
    );

    if (validateOperationID['status'] === 404) {
      throw new ConflictException(
        `No se encontró la operación con ID: ${billDb.id_operation}`,
      );
    }

    // ✅ Asegurar que el DTO tenga un id para las funciones internas
    const completeUpdateBillDto = {
      ...normalizedUpdateBillDto,
      id: groupId // Usar el groupId determinado arriba
    };

    this.logger.log(
      `[BillUpdate][NORMALIZED] bill=${id} group=${groupId} amount=${(completeUpdateBillDto as any)?.amount ?? 'N/A'} number_of_hours=${(completeUpdateBillDto as any)?.number_of_hours ?? 'N/A'} pays_count=${Array.isArray((completeUpdateBillDto as any)?.pays) ? (completeUpdateBillDto as any).pays.length : 0}`,
    );

    // Si no llegan pagos en el payload, reutilizar los ya persistidos en billDetail.
    if (!Array.isArray(completeUpdateBillDto.pays) || completeUpdateBillDto.pays.length === 0) {
      const existingPays = await this.prisma.billDetail.findMany({
        where: { id_bill: id },
        include: {
          operationWorker: {
            select: {
              id_worker: true,
            },
          },
        },
      });

      completeUpdateBillDto.pays = existingPays.map((detail) => ({
        id_worker: detail.operationWorker.id_worker,
        pay: Number(detail.pay_unit ?? 1),
        pay_rate: Number(detail.pay_rate ?? 0),
      }));

      this.logger.warn(
        `[BillUpdate][PAYS_FALLBACK] bill=${id} group=${groupId} pays_loaded_from_db=${completeUpdateBillDto.pays.length}`,
      );
    }

    this.validateUpdateGroups([completeUpdateBillDto]);

    const recalcularTotales = this.shouldRecalculateTotals([completeUpdateBillDto]) || shouldUpdateGroupDates;

    await this.updateBillFields(id, [completeUpdateBillDto], existingBill, userId);

    if (recalcularTotales) {
      await this.recalculateBillTotals(
        id,
        completeUpdateBillDto,
        validateOperationID,
        userId,
        billDb.id_operation,
        billDb.amount,
        billDb,
      );
    } else {
      await this.updateBillDetailsOnly(
        id,
        completeUpdateBillDto,
        validateOperationID,
        existingBill,
        billDb.id_operation,
      );
    }

    // ✅ Recalcular group_hours automáticamente después de editar la Bill
    await this.recalculateGroupHoursFromWorkerDates(
      billDb.id_operation,
      groupId,
    );

    const billDB = await this.findOne(id);

    this.logger.log(
      `[BillUpdate][PERSISTED] bill=${id} group=${billDB?.id_group || 'N/A'} amount=${billDB?.amount ?? 'N/A'} number_of_hours=${billDB?.number_of_hours ?? 'N/A'} group_hours=${billDB?.group_hours ?? 'N/A'} total_bill=${billDB?.total_bill ?? 'N/A'} total_paysheet=${billDB?.total_paysheet ?? 'N/A'}`,
    );

    return billDB;
  }

  /**
   * Recalcula la factura completa después de cambiar op_duration
   * Se usa cuando se actualizan fechas de una operación COMPLETED
   */
  async recalculateBillAfterOpDurationChange(billId: number, operationId: number) {
    // console.log(`[BillService] 🔄 Recalculando factura ${billId} por cambio en op_duration de operación ${operationId}`);
    
    try {
      // Obtener la factura actual con sus detalles
      const bill = await this.prisma.bill.findUnique({
        where: { id: billId },
        include: {
          billDetails: {
            include: {
              operationWorker: {
                include: {
                  worker: true,
                },
              },
            },
          },
        },
      });

      if (!bill) {
        throw new ConflictException(`No se encontró la factura con ID: ${billId}`);
      }
      // console.log(`[BillService] 📊 Factura actual tiene ${bill.billDetails.length} detalles`);

      // ✅ OBTENER TRABAJADORES ACTUALES DE LA OPERACIÓN (puede incluir nuevos trabajadores)
      const currentOperationWorkers = await this.prisma.operation_Worker.findMany({
        where: { 
          id_operation: operationId,
          id_group: bill.id_group, // Solo trabajadores del grupo de esta factura
        },
        include: {
          worker: true,
        },
      });

      // console.log(`[BillService] 👥 Operación tiene ${currentOperationWorkers.length} trabajadores en el grupo ${bill.id_group}`);

      // Identificar trabajadores a eliminar de la factura
      const currentWorkerIds = currentOperationWorkers.map(ow => ow.id_worker);
      const billWorkerIds = bill.billDetails.map(bd => bd.operationWorker.id_worker);
      
      const workersToRemove = billWorkerIds.filter(id => !currentWorkerIds.includes(id));
      const workersToAdd = currentWorkerIds.filter(id => !billWorkerIds.includes(id));

    

      // Eliminar detalles de trabajadores que ya no están en la operación
      if (workersToRemove.length > 0) {
        const operationWorkerIdsToRemove = bill.billDetails
          .filter(bd => workersToRemove.includes(bd.operationWorker.id_worker))
          .map(bd => bd.id_operation_worker);

        await this.prisma.billDetail.deleteMany({
          where: {
            id_bill: billId,
            id_operation_worker: { in: operationWorkerIdsToRemove },
          },
        });

        // console.log(`[BillService] 🗑️ Eliminados ${operationWorkerIdsToRemove.length} detalles de factura`);
      }

      // Agregar detalles para trabajadores nuevos
      if (workersToAdd.length > 0) {
        const newOperationWorkers = currentOperationWorkers.filter(ow => 
          workersToAdd.includes(ow.id_worker)
        );

        const newBillDetails = newOperationWorkers.map(ow => ({
          id_bill: billId,
          id_operation_worker: ow.id,
          pay_unit: 1,
          pay_rate: 0,
          total_bill: 0,
          total_paysheet: 0,
        }));

        await this.prisma.billDetail.createMany({
          data: newBillDetails,
        });

        // console.log(`[BillService] ➕ Agregados ${newBillDetails.length} nuevos detalles de factura`);
      }

      // Obtener información actualizada de la operación con nuevo op_duration
      const validateOperationID = await this.validateOperation(operationId);
      
      if (validateOperationID['status'] === 404) {
        throw new ConflictException(`No se encontró la operación con ID: ${operationId}`);
      }

      // console.log(`[BillService] ✅ op_duration actualizado: ${validateOperationID.op_duration} horas`);

      // // ✅ PREPARAR DTO MÍNIMO CON DISTRIBUCIONES VACÍAS PARA FORZAR RECÁLCULO
      // const updateBillDto: UpdateBillDto = {
      //   id: String(bill.id_group || ''),
      //   amount: 0, // ✅ Forzar recálculo desde cero
      //   billHoursDistribution: {
      //     HOD: 0,
      //     HON: 0,
      //     HED: 0,
      //     HEN: 0,
      //     HFOD: 0,
      //     HFON: 0,
      //     HFED: 0,
      //     HFEN: 0,
      //   },
      //   paysheetHoursDistribution: {
      //     HOD: 0,
      //     HON: 0,
      //     HED: 0,
      //     HEN: 0,
      //     HFOD: 0,
      //     HFON: 0,
      //     HFED: 0,
      //     HFEN: 0,
      //   },
      //   pays: bill.billDetails.map((detail) => ({
      //     id_worker: detail.operationWorker.worker.id,
      //     pay: 0, // ✅ Recalcular desde cero
      //   })),
      // };

      // console.log(`[BillService] 🔄 Recalculando con op_duration=${validateOperationID.op_duration} (distribuciones en cero para recálculo completo)`);

      // Preparar DTO para recálculo completo
      const updatedBillDetails = await this.prisma.billDetail.findMany({
        where: { id_bill: billId },
        include: {
          operationWorker: {
            include: {
              worker: true,
            },
          },
        },
      });

      // ✅ MANTENER LAS DISTRIBUCIONES ORIGINALES DE LA BASE DE DATOS
      // Las distribuciones fueron calculadas correctamente en el frontend y guardadas en la BD
      // NO debemos recalcularlas, solo recalcular los totales con el nuevo número de trabajadores
      const updateBillDto: UpdateBillDto = {
        id: String(bill.id_group || ''),
        amount: bill.amount,
        group_hours: bill.group_hours ? new Decimal(bill.group_hours.toString()) : new Decimal(0),
        billHoursDistribution: {
          HOD: Number(bill.FAC_HOD) || 0,
          HON: Number(bill.FAC_HON) || 0,
          HED: Number(bill.FAC_HED) || 0,
          HEN: Number(bill.FAC_HEN) || 0,
          HFOD: Number(bill.FAC_HFOD) || 0,
          HFON: Number(bill.FAC_HFON) || 0,
          HFED: Number(bill.FAC_HFED) || 0,
          HFEN: Number(bill.FAC_HFEN) || 0,
        },
        paysheetHoursDistribution: {
          HOD: Number(bill.HOD) || 0,
          HON: Number(bill.HON) || 0,
          HED: Number(bill.HED) || 0,
          HEN: Number(bill.HEN) || 0,
          HFOD: Number(bill.HFOD) || 0,
          HFON: Number(bill.HFON) || 0,
          HFED: Number(bill.HFED) || 0,
          HFEN: Number(bill.HFEN) || 0,
        },
        pays: updatedBillDetails.map((detail) => ({
          id_worker: detail.operationWorker.worker.id,
          pay: Number(detail.pay_unit) || 1,
        })),
      };

      // console.log(`[BillService] 🔄 Recalculando factura con ${updatedBillDetails.length} trabajadores`);




      // Recalcular totales con el nuevo op_duration propagado en validateOperationID
      await this.recalculateBillTotals(
        billId,
        updateBillDto,
        validateOperationID,
        bill.id_user,
        operationId,
        bill.amount,
        bill,
      );

      // ❌ REMOVIDO: No llamar recursivamente recalculateGroupHoursFromWorkerDates
      // para evitar bucles infinitos cuando se llama desde recalculateGroupHoursFromWorkerDates
      
      return { 
        success: true, 
        message: 'Factura recalculada con los nuevos trabajadores',
        workersRemoved: workersToRemove.length,
        workersAdded: workersToAdd.length,
      };
    } catch (error) {
      console.error(`[BillService] ❌ Error recalculando factura ${billId}:`, error);
      throw error;
    }
  }

  async updateStatus(id: number, status: BillStatus, userId: number) {
    const existingBill = await this.prisma.bill.findUnique({ where: { id } });
    if (!existingBill) {
      throw new ConflictException(`No se encontró la factura con ID: ${id}`);
    }

    const updatedBill = await this.prisma.bill.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
        id_user: userId,
      },
    });

    return {
      id: updatedBill.id,
      status: updatedBill.status,
      message: `Estado de la factura actualizado a ${status}`,
    };
  }

  private validateUpdateGroups(groups: GroupBillDto[]) {
    if (!groups || groups.length === 0) {
      throw new ConflictException(
        'La operación no tiene grupos de trabajadores asignados.',
      );
    }
    for (const group of groups) {
      if (!group.pays || group.pays.length === 0) {
        throw new ConflictException(
          `El grupo con ID ${group.id || 'desconocido'} no tiene asignados pagos para los trabajadores.`,
        );
      }
    }
  }

  private shouldRecalculateTotals(groups: GroupBillDto[]): boolean {
    return groups.some(
      (group) =>
        group.billHoursDistribution ||
        group.paysheetHoursDistribution ||
        typeof group.amount !== 'undefined',
    );
  }

  private async updateBillFields(
    id: number,
    groups: GroupBillDto[],
    existingBill: any,
    userId: number,
  ) {
    for (const group of groups) {
      const updateData: any = {
        updatedAt: new Date(),
        id_user: userId,
      };

      // Manejar observaciones
      if (group.observation !== undefined) {
        updateData.observation = group.observation;
      }

      // === ACTUALIZAR AMOUNT SI SE PROPORCIONA ===
      if (typeof group.amount !== 'undefined') {
        updateData.amount = group.amount;
      }

      // NOTA: group_hours NO se actualiza aquí porque se calcula automáticamente
      // desde las fechas de Operation_Worker mediante recalculateGroupHoursFromWorkerDates()

      let finalNumberOfHours: number | undefined = undefined;

      // Procesar billHoursDistribution (FACTURACIÓN)
      if (group.billHoursDistribution) {
        // Calcular el total de horas de facturación
        const billTotalHours = Object.values(
          group.billHoursDistribution,
        ).reduce((acc: number, hours: number) => acc + (hours || 0), 0);

        Object.assign(updateData, {
          // billHoursDistribution va a las columnas CON prefijo FAC_ (FACTURACIÓN)
          FAC_HOD: group.billHoursDistribution.HOD ?? existingBill.FAC_HOD,
          FAC_HON: group.billHoursDistribution.HON ?? existingBill.FAC_HON,
          FAC_HED: group.billHoursDistribution.HED ?? existingBill.FAC_HED,
          FAC_HEN: group.billHoursDistribution.HEN ?? existingBill.FAC_HEN,
          FAC_HFOD: group.billHoursDistribution.HFOD ?? existingBill.FAC_HFOD,
          FAC_HFON: group.billHoursDistribution.HFON ?? existingBill.FAC_HFON,
          FAC_HFED: group.billHoursDistribution.HFED ?? existingBill.FAC_HFED,
          FAC_HFEN: group.billHoursDistribution.HFEN ?? existingBill.FAC_HFEN,
        });

        // Establecer las horas de facturación como prioritarias
        finalNumberOfHours = billTotalHours;
      }

      // Procesar paysheetHoursDistribution (NÓMINA)
      if (group.paysheetHoursDistribution) {
        Object.assign(updateData, {
          // paysheetHoursDistribution va a las columnas SIN prefijo FAC_ (NÓMINA)
          HOD: group.paysheetHoursDistribution.HOD ?? existingBill.HOD,
          HON: group.paysheetHoursDistribution.HON ?? existingBill.HON,
          HED: group.paysheetHoursDistribution.HED ?? existingBill.HED,
          HEN: group.paysheetHoursDistribution.HEN ?? existingBill.HEN,
          HFOD: group.paysheetHoursDistribution.HFOD ?? existingBill.HFOD,
          HFON: group.paysheetHoursDistribution.HFON ?? existingBill.HFON,
          HFED: group.paysheetHoursDistribution.HFED ?? existingBill.HFED,
          HFEN: group.paysheetHoursDistribution.HFEN ?? existingBill.HFEN,
        });

        // Solo usar las horas de paysheet si NO hay horas de facturación
        if (finalNumberOfHours === undefined) {
          const paysheetTotalHours = Object.values(
            group.paysheetHoursDistribution,
          ).reduce((acc: number, hours: number) => acc + (hours || 0), 0);
          finalNumberOfHours = paysheetTotalHours || finalNumberOfHours;
        }
      }

      // Aplicar el número de horas final
      if (finalNumberOfHours !== undefined) {
        updateData.number_of_hours = finalNumberOfHours;
      }

      // console.log('Final number of hours:', finalNumberOfHours);
      // console.log('Update data for bill:', updateData);

      await this.prisma.bill.update({
        where: { id },
        data: updateData,
      });
    }
  }
  private async recalculateBillTotals(
    id: number,
    group: UpdateBillDto,
    validateOperationID: any,
    userId: number,
    id_operation: number,
    amountDb: number,
    billDb?: any,
  ) {
    let totalAmount = 0;
    let totalPaysheet = 0;
    let numberOfWorkers = 0;

    if (!group) {
      throw new ConflictException(
        'No se proporcionaron grupos para actualizar la factura.',
      );
    }

    const matchingGroupSummary = validateOperationID.workerGroups.find(
      (summary) => summary.groupId === group.id,
    );
    if (!matchingGroupSummary) {
      throw new ConflictException(
        `No se encontró el grupo con ID: ${group.id} en la operación.`,
      );
    }

    // ✅ OBTENER LA DURACIÓN ACTUALIZADA DEL GRUPO DESDE LA BD
    const currentBill = await this.prisma.bill.findUnique({
      where: { id },
      select: { group_hours: true, id_group: true }
    });

    if (currentBill) {
      // console.log(`🔄 [recalculateBillTotals] Actualizando group_hours en matchingGroupSummary:`, {
      //   grupoId: currentBill.id_group,
      //   groupHoursActual: currentBill.group_hours,
      //   groupHoursAnterior: matchingGroupSummary.group_hours || 'no definido'
      // });
      
      // Asegurar que el matchingGroupSummary tenga la duración actualizada
      matchingGroupSummary.group_hours = Number(currentBill.group_hours) || matchingGroupSummary.group_hours || 0;
    }

    const { totalPaysheetGroup, totalFacturationGroup } =
      await this.calculateGroupTotalsForUpdate(
        matchingGroupSummary,
        group,
        amountDb,
        billDb,
      );

    totalAmount += totalFacturationGroup;
    totalPaysheet += totalPaysheetGroup;
    numberOfWorkers +=
      matchingGroupSummary.workers?.length || group.pays.length;

    await this.updateWorkerDetails(
      id,
      group,
      matchingGroupSummary,
      totalPaysheetGroup,
      totalFacturationGroup,
      id_operation,
    );

    await this.prisma.bill.update({
      where: { id },
      data: {
        total_bill: totalAmount,
        total_paysheet: totalPaysheet,
        number_of_workers: numberOfWorkers,
        updatedAt: new Date(),
        id_user: userId,
      },
    });
  }

  private async calculateGroupTotalsForUpdate(
    matchingGroupSummary: any,
    group: GroupBillDto,
    amountDb: number,
    billDb?: any,
  ) {
    let totalPaysheetGroup = 0;
    let totalFacturationGroup = 0;

    // Agrega logs para depuración
    // console.log('matchingGroupSummary:', matchingGroupSummary);
    // console.log(
    //   'matchingGroupSummary.dateRange:',
    //   matchingGroupSummary?.dateRange,
    // );
    //movio
    if (matchingGroupSummary.schedule.unit_of_measure === 'JORNAL') {
      matchingGroupSummary.paysheet_tariff =
        matchingGroupSummary.tariffDetails?.paysheet_tariff ?? 0;
      matchingGroupSummary.facturation_tariff =
        matchingGroupSummary.tariffDetails?.facturation_tariff ?? 0;
      matchingGroupSummary.agreed_hours =
        matchingGroupSummary.tariffDetails?.agreed_hours ?? 0;
      matchingGroupSummary.hours = matchingGroupSummary.tariffDetails?.hours ?? 0;
      matchingGroupSummary.workerCount =
        matchingGroupSummary.workers?.length || 0; // <-- Agrega esto

      const dateStart = matchingGroupSummary.schedule?.dateStart || new Date();

      const result = this.payrollCalculationService.processJornalGroups(
        [matchingGroupSummary],
        [group],
        dateStart,
      ).groupResults[0];

      totalPaysheetGroup = result?.payroll?.totalAmount || 0;
      totalFacturationGroup = result?.billing?.totalAmount || 0;
    } else if (
      matchingGroupSummary.schedule.unit_of_measure === 'HORAS' &&
      matchingGroupSummary.tariffDetails?.alternative_paid_service !== 'YES'
    ) {
// AGREGAR workerCount para grupos de HORAS
      matchingGroupSummary.workerCount =
        matchingGroupSummary.workers?.length || 0;
      
      // console.log(`🔧 [calculateGroupTotalsForUpdate] HORAS - workerCount: ${matchingGroupSummary.workerCount}`);



      const result = await this.hoursCalculationService.processHoursGroups(
        matchingGroupSummary,
        group,
        billDb?.status,
      );
      totalPaysheetGroup = result.totalFinalPayroll;
      totalFacturationGroup = result.totalFinalFacturation;
    } else if (
      matchingGroupSummary.tariffDetails?.alternative_paid_service === 'YES'
    ) {
      const { totalFacturation, totalPaysheet } =
        await this.calculateAlternativeServiceTotals(
          matchingGroupSummary,
          group,
        );
      totalPaysheetGroup = totalPaysheet;
      totalFacturationGroup = totalFacturation;
    } else {
      const { totalPaysheet, totalFacturation } = this.calculateQuantityTotals(
        matchingGroupSummary,
        group,
        amountDb,
      );
      totalPaysheetGroup = totalPaysheet;
      totalFacturationGroup = totalFacturation;
    }

    return { totalPaysheetGroup, totalFacturationGroup };
  }

  private async updateWorkerDetails(
    billId: number,
    group: GroupBillDto | UpdateBillDto,
    matchingGroupSummary: any,
    totalPaysheetGroup: number,
    totalFacturationGroup: number,
    operationId?: number,
  ){
     // ✅ CORRECCIÓN: Obtener los trabajadores del grupo desde la BD si pays está vacío o mal formado
    const operationWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation: operationId,
        id_group: group.id,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

   

    // ✅ Construir el array de pays correcto desde la BD y el DTO
    const validPays = operationWorkers.map(ow => {
      // Buscar si hay un pay específico en el DTO para este trabajador
      const payDto = Array.isArray(group.pays) 
        ? group.pays.find((p: any) => p?.id_worker === ow.id_worker)
        : null;
      
      return {
        id_worker: ow.id_worker,
        pay: payDto?.pay ?? 1, // Por defecto 1 si no viene en el DTO
      };
    });


    // ✅ Iterar sobre los trabajadores reales de la BD
    for (const operationWorker of operationWorkers) {
      let billDetail = await this.prisma.billDetail.findFirst({
        where: {
          id_bill: billId,
          id_operation_worker: operationWorker.id,
        },
      });

      // Obtener el pay de este trabajador desde el array procesado
      const workerPay = validPays.find(p => p.id_worker === operationWorker.id_worker);
      const payValue = workerPay?.pay ?? 1;

      const totalWorkerPaysheet = this.calculateTotalWorker(
        totalPaysheetGroup,
        { ...group, pays: validPays }, // ✅ Usar pays procesados
        { id: operationWorker.id_worker },
        matchingGroupSummary.workers,
      );
      const totalWorkerFacturation = this.calculateTotalWorker(
        totalFacturationGroup,
        { ...group, pays: validPays }, // ✅ Usar pays procesados
        { id: operationWorker.id_worker },
        matchingGroupSummary.workers,
      );

      // USAR la función calculatePayRateForWorker en lugar de lógica manual
      const payRate = this.calculatePayRateForWorker(
        matchingGroupSummary,
        { ...group, pays: validPays }, // ✅ Usar pays procesados
        validPays,
        Number(payValue),
        { amount: group.amount || 0 }, // existingBill simulado
      );

      // ✅ Si no existe el billDetail, crearlo
      if (!billDetail) {
        console.log(`✅ Creando billDetail para nuevo operation_worker ${operationWorker.id}`);
        billDetail = await this.prisma.billDetail.create({
          data: {
            id_bill: billId,
            id_operation_worker: operationWorker.id,
            pay_rate: payRate,
            pay_unit: payValue,
            total_bill: totalWorkerFacturation,
            total_paysheet: totalWorkerPaysheet,
          },
        });
      } else {
        // Actualizar el billDetail existente
        await this.prisma.billDetail.update({
          where: { id: billDetail.id },
          data: {
            pay_rate: payRate,
            pay_unit: payValue,
            total_bill: totalWorkerFacturation,
            total_paysheet: totalWorkerPaysheet,
          },
        });
      }

    }
  }
  //  {
  //   for (const pay of group.pays) {
  //     const operationWorker = await this.prisma.operation_Worker.findFirst({
  //       where: {
  //         id_worker: pay.id_worker,
  //         id_operation: operationId || billId,
  //       },
  //     });
  //     if (!operationWorker) continue;

  //     const billDetail = await this.prisma.billDetail.findFirst({
  //       where: {
  //         id_bill: billId,
  //         id_operation_worker: operationWorker.id,
  //       },
  //     });
  //     if (!billDetail) continue;

  //     const totalWorkerPaysheet = this.calculateTotalWorker(
  //       totalPaysheetGroup,
  //       group,
  //       { id: pay.id_worker },
  //       matchingGroupSummary.workers,
  //     );
  //     const totalWorkerFacturation = this.calculateTotalWorker(
  //       totalFacturationGroup,
  //       group,
  //       { id: pay.id_worker },
  //       matchingGroupSummary.workers,
  //     );

  //     // Construir groupPay para el cálculo del pay_rate
  //     const groupPay = group.pays.map((p) => ({
  //       id_worker: p.id_worker,
  //       pay: p.pay,
  //     }));

  //     // USAR la función calculatePayRateForWorker en lugar de lógica manual
  //     const payRate = this.calculatePayRateForWorker(
  //       matchingGroupSummary,
  //       group,
  //       groupPay,
  //       Number(pay.pay),
  //       { amount: group.amount || 0 }, // existingBill simulado
  //     );

  //     await this.prisma.billDetail.update({
  //       where: { id: billDetail.id },
  //       data: {
  //         pay_rate: payRate,
  //         pay_unit: pay.pay ?? billDetail.pay_unit,
  //         total_bill: totalWorkerFacturation,
  //         total_paysheet: totalWorkerPaysheet,
  //       },
  //     });
  //   }
  // }


  private async updateBillDetailsOnly(
    id: number,
    updateBillDto: UpdateBillDto,
    validateOperationID: any,
    existingBill: any,
    id_operation: number,
  ) {
    if (!updateBillDto) {
      throw new ConflictException(
        'No se proporcionaron grupos para actualizar la factura.',
      );
    }
    for (const group of [updateBillDto]) {
      const matchingGroupSummary = validateOperationID.workerGroups.find(
        (summary) => summary.groupId === group.id,
      );
      if (!matchingGroupSummary) continue;

      const operationWorkers = await this.prisma.operation_Worker.findMany({
        where: {
          id_operation: id_operation ?? existingBill.id_operation,
          id_group: group.id,
        },
      });

      const billDetails = await this.prisma.billDetail.findMany({
        where: {
          id_bill: id,
          id_operation_worker: {
            in: operationWorkers.map((ow) => ow.id),
          },
        },
        include: {
          operationWorker: {
            include: {
              worker: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      // Determinar el tipo de grupo y calcular totales
      const { totalPaysheetGroup, totalFacturationGroup } =
        await this.getExistingOrCalculateGroupTotals(
          matchingGroupSummary,
          group,
          existingBill,
          existingBill.amount,
        );

      // Construir pays actualizado para todos los trabajadores del grupo
      const groupPay = this.buildGroupPayArray(billDetails, group);

      // Actualizar detalles de cada trabajador
      await this.updateWorkersInGroup(
        id,
        operationWorkers,
        group,
        groupPay,
        matchingGroupSummary,
        totalPaysheetGroup,
        totalFacturationGroup,
        existingBill,
      );
    }
  }

  private async getExistingOrCalculateGroupTotals(
    matchingGroupSummary: any,
    group: GroupBillDto,
    existingBill: any,
    amountDb: number,
  ) {
    let totalPaysheetGroup = 0;
    let totalFacturationGroup = 0;

    const isHoursOrJornal =
      matchingGroupSummary.schedule?.unit_of_measure === 'JORNAL' ||
      matchingGroupSummary.schedule?.unit_of_measure === 'HORAS' ||
      matchingGroupSummary.schedule?.facturation_unit === 'JORNAL' ||
      matchingGroupSummary.schedule?.facturation_unit === 'HORAS';

    if (isHoursOrJornal) {
      // Usar totales existentes para grupos de horas/jornal sin recalcular
      totalPaysheetGroup = Number(existingBill.total_paysheet) || 0;
      totalFacturationGroup = Number(existingBill.total_bill) || 0;
    } else if (matchingGroupSummary.alternative_paid_service === 'YES') {
      // Recalcular para servicios alternativos
      const { totalFacturation, totalPaysheet } =
        await this.calculateAlternativeServiceTotals(
          matchingGroupSummary,
          group,
        );
      totalPaysheetGroup = totalPaysheet;
      totalFacturationGroup = totalFacturation;
    } else {
      // Recalcular para grupos por cantidad
      const { totalPaysheet, totalFacturation } = this.calculateQuantityTotals(
        matchingGroupSummary,
        group,
        amountDb,
      );
      totalPaysheetGroup = totalPaysheet;
      totalFacturationGroup = totalFacturation;
    }

    return { totalPaysheetGroup, totalFacturationGroup };
  }

  private buildGroupPayArray(billDetails: any[], group: GroupBillDto) {
    return billDetails.map((bd) => {
      const payDto = group.pays.find(
        (x) => x.id_worker === bd.operationWorker.worker.id,
      );
      let payValueWorker = payDto?.pay ?? (bd.pay_unit || 1); // Valor por defecto si no se encuentra el pago
      if (payValueWorker === null || payValueWorker === undefined) {
        payValueWorker = 1;
      }
      return {
        id_worker: bd.operationWorker.worker.id,
        pay: Number(payValueWorker),
      };
    });
  }

  private async updateWorkersInGroup(
    billId: number,
    operationWorkers: any[],
    group: GroupBillDto,
    groupPay: any[],
    matchingGroupSummary: any,
    totalPaysheetGroup: number,
    totalFacturationGroup: number,
    existingBill: any,
  ) {
    for (const operationWorker of operationWorkers) {
      const billDetail = await this.prisma.billDetail.findFirst({
        where: {
          id_bill: billId,
          id_operation_worker: operationWorker.id,
        },
      });
      if (!billDetail) continue;

      // Buscar el pago actualizado en el DTO
      const pay = group.pays.find(
        (p) => p.id_worker === operationWorker.id_worker,
      );
      const payValue = pay?.pay ?? billDetail.pay_unit;

      // Calcular subtotales por trabajador
      const totalWorkerPaysheet = this.calculateTotalWorker(
        totalPaysheetGroup,
        { ...group, pays: groupPay },
        { id: operationWorker.id_worker },
        matchingGroupSummary.workers,
      );
      const totalWorkerFacturation = this.calculateTotalWorker(
        totalFacturationGroup,
        { ...group, pays: groupPay },
        { id: operationWorker.id_worker },
        matchingGroupSummary.workers,
      );

      if (!payValue) {
        throw new ConflictException(
          `No se encontró el pago para el trabajador con ID: ${operationWorker.id_worker}`,
        );
      }

      // Calcular pay_rate según el tipo de grupo
      let payRate = this.calculatePayRateForWorker(
        matchingGroupSummary,
        group,
        groupPay,
        Number(payValue),
        existingBill,
      );

      await this.prisma.billDetail.update({
        where: { id: billDetail.id },
        data: {
          pay_rate: payRate,
          pay_unit: payValue,
          total_bill: totalWorkerFacturation,
          total_paysheet: totalWorkerPaysheet,
        },
      });
    }
  }

  private calculatePayRateForWorker(
    matchingGroupSummary: any,
    group: GroupBillDto | UpdateBillDto,
    groupPay: any[],
    payValue: number,
    existingBill: any,
  ): number {
    // Obtener datos del tariff
    const tariffDetails = matchingGroupSummary.tariffDetails;
    const scheduleUnitOfMeasure =
      matchingGroupSummary.schedule?.unit_of_measure;

    // Detectar servicio alternativo
    const isAlternativeService =
      tariffDetails?.alternative_paid_service === 'YES';

    // Detectar grupo de cantidad (no HORAS, no JORNAL, sin servicio alternativo)
    const isQuantityGroup =
      scheduleUnitOfMeasure !== 'HORAS' &&
      scheduleUnitOfMeasure !== 'JORNAL' &&
      !isAlternativeService &&
      !tariffDetails?.facturationUnit;

    // Detectar grupo de horas simples (HORAS sin servicio alternativo)
    const isSimpleHoursGroup =
      scheduleUnitOfMeasure === 'HORAS' && !isAlternativeService;

    // Detectar grupo jornal (JORNAL sin servicio alternativo)
    const isJornalGroup =
      scheduleUnitOfMeasure === 'JORNAL' && !isAlternativeService;

    if (isAlternativeService) {
      const facturationUnit =
        tariffDetails?.facturationUnit?.name ||
        matchingGroupSummary.facturation_unit ||
        scheduleUnitOfMeasure;

      if (facturationUnit !== 'HORAS' && facturationUnit !== 'JORNAL') {
        const totalUnitPays = groupPay.reduce(
          (sum, p) => sum + (p.pay || 0),
          0,
        );
        const safeAmount = Number(group.amount) || existingBill.amount || 0;
        const safeTotalUnidades = Number(totalUnitPays) || 1;
        const safePayValue =
          payValue !== null && payValue !== undefined ? Number(payValue) : 1;
        const result = (safeAmount / safeTotalUnidades) * safePayValue;

        return result;
      } else {
        // Para servicios alternativos con HORAS/JORNAL, usar payValue directamente

        return payValue;
      }
    } else if (isQuantityGroup) {
      const totalUnidades = groupPay.reduce((sum, p) => sum + (p.pay || 0), 0);
      const safeAmount = Number(group.amount) || existingBill.amount || 0;
      const safeTotalUnidades = Number(totalUnidades) || 1;
      const safePayValue =
        payValue !== null && payValue !== undefined ? Number(payValue) : 1;
      const result = (safeAmount / safeTotalUnidades) * safePayValue;
      return result;
    } else if (isSimpleHoursGroup || isJornalGroup) {
      // Para grupos de HORAS y JORNAL simples, pay_rate = payValue
      return payValue;
    }

    // Fallback: retornar payValue
    return payValue;
  }

  /**
   * Recalcula el op_duration de una operación sumando todos los group_hours de sus bills
   * @param id_operation ID de la operación
   * @param id_group ID del grupo que se modificó (opcional, solo para logs)
   */
  private async recalculateOpDuration(id_operation: number, id_group?: string) {
    // console.log(`[BillService] 🔄 Recalculando op_duration para operación ${id_operation}`);
    
    try {
      // Obtener todas las bills de la operación con sus group_hours
      const bills = await this.prisma.bill.findMany({
        where: {
          id_operation: id_operation,
        },
        select: {
          id_group: true,
          group_hours: true,
        },
      });

      // console.log(`[BillService] 📊 Se encontraron ${bills.length} bills para la operación`);

      // Sumar todos los group_hours de los grupos
      const totalOpDuration = bills.reduce((sum, bill) => {
        const groupHours = Number(bill.group_hours) || 0;
        // console.log(`[BillService]   - Grupo ${bill.id_group}: ${groupHours} horas`);
        return sum + groupHours;
      }, 0);

      // console.log(`[BillService] ✅ Nuevo op_duration calculado: ${totalOpDuration} horas`);

      // Actualizar el op_duration en la tabla Operation
      await this.prisma.operation.update({
        where: { id: id_operation },
        data: {
          op_duration: totalOpDuration,
        },
      });

      // console.log(`[BillService] ✅ op_duration actualizado en la operación ${id_operation}`);

    } catch (error) {
      console.error(`[BillService] ❌ Error recalculando op_duration:`, error);
      throw new ConflictException(
        `Error al recalcular la duración de la operación: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Recalcula el group_hours de un grupo específico basándose en las fechas de los Operation_Worker
   * Esta función debe ser llamada cuando se actualizan las fechas de los trabajadores de un grupo
   * @param id_operation ID de la operación
   * @param id_group ID del grupo
   * @returns El group_hours calculado
   */
  async recalculateGroupHoursFromWorkerDates(
    id_operation: number,
    id_group: string
  ): Promise<number> {
    // console.log(`[BillService] 🔄 Recalculando group_hours para grupo ${id_group} de operación ${id_operation}`);
    
    try {
      // Obtener todos los trabajadores del grupo
      const workers = await this.prisma.operation_Worker.findMany({
        where: {
          id_operation,
          id_group: String(id_group),
        },
        select: {
          id: true,
          dateStart: true,
          timeStart: true,
          dateEnd: true,
          timeEnd: true,
        },
      });

      if (workers.length === 0) {
        console.warn(`[BillService] ⚠️ No se encontraron trabajadores para el grupo ${id_group}`);
        return 0;
      }

      // console.log(`[BillService] 📊 Calculando duración promedio de ${workers.length} trabajadores`);

      // Calcular la duración promedio de los trabajadores del grupo
      let totalHoras = 0;
      let count = 0;

      for (const worker of workers) {
        if (worker.dateStart && worker.timeStart && worker.dateEnd && worker.timeEnd) {
          let startDate = new Date(worker.dateStart);
          const [sh, sm] = worker.timeStart.split(':').map(Number);
          startDate.setHours(sh, sm, 0, 0);

          let endDate = new Date(worker.dateEnd);
          const [eh, em] = worker.timeEnd.split(':').map(Number);
          endDate.setHours(eh, em, 0, 0);

          // ✅ Detectar y corregir fechas invertidas
          if (startDate > endDate) {
            console.warn(`[BillService] ⚠️ Fechas invertidas detectadas para worker ${worker.id}, intercambiando...`);
            [startDate, endDate] = [endDate, startDate];
          }

          const diff = (endDate.getTime() - startDate.getTime()) / 3_600_000; // Convertir a horas

          if (diff > 0) {
            totalHoras += diff;
            count++;
            // console.log(`[BillService]   - Worker ${worker.id}: ${diff.toFixed(2)} horas`);
          }
        }
      }

      const groupHours = count > 0 ? Math.round((totalHoras / count) * 100) / 100 : 0;
      // console.log(`[BillService] ✅ group_hours calculado: ${groupHours} horas (promedio de ${count} trabajadores)`);

      // Actualizar el bill del grupo con el nuevo group_hours
      const bill = await this.prisma.bill.findFirst({
        where: {
          id_operation,
          id_group: String(id_group),
        },
      });

      if (bill) {
        // console.log(`[BillService] 📝 Actualizando Bill ${bill.id} con group_hours: ${groupHours}`);
        
        const updatedBill = await this.prisma.bill.update({
          where: { id: bill.id },
          data: {
            group_hours: groupHours,
            number_of_hours: groupHours, // ✅ TAMBIÉN ACTUALIZAR number_of_hours
          },
        });
        
        // console.log(`[BillService] ✅ Bill ${bill.id} actualizado. Nuevo valor: ${updatedBill.group_hours}, number_of_hours: ${updatedBill.number_of_hours}`);

        // Recalcular op_duration de toda la operación
        await this.recalculateOpDuration(id_operation, id_group);

        // ✅ FORZAR RECÁLCULO COMPLETO cuando cambian las horas del grupo
        // Esto asegura que se recalculen compensatorio, totales de facturación y nómina
        try {
          // console.log(`[BillService] 🔄 Forzando recálculo completo para Bill ${bill.id} tras cambio de horas`);
          
          // Obtener la información actualizada de la operación
          const validateOperationID = await this.validateOperation(id_operation);
          
          if (validateOperationID['status'] !== 404) {
            // Obtener los detalles actuales de la factura para los pays
            const billDetails = await this.prisma.billDetail.findMany({
              where: { id_bill: bill.id },
              include: {
                operationWorker: {
                  include: { worker: true },
                },
              },
            });

            // Preparar UpdateBillDto para forzar recálculo
            const updateBillDto: UpdateBillDto = {
              id: String(id_group),
              amount: bill.amount || 0, // ✅ USAR AMOUNT DE LA BD
              group_hours: new Decimal(groupHours.toString()),
              billHoursDistribution: {
                HOD: Number(bill.HOD) || 0,
                HON: Number(bill.HON) || 0,
                HED: Number(bill.HED) || 0,
                HEN: Number(bill.HEN) || 0,
                HFOD: Number(bill.HFOD) || 0,
                HFON: Number(bill.HFON) || 0,
                HFED: Number(bill.HFED) || 0,
                HFEN: Number(bill.HFEN) || 0,
              },
              paysheetHoursDistribution: {
                HOD: Number(bill.HOD) || 0,
                HON: Number(bill.HON) || 0,
                HED: Number(bill.HED) || 0,
                HEN: Number(bill.HEN) || 0,
                HFOD: Number(bill.HFOD) || 0,
                HFON: Number(bill.HFON) || 0,
                HFED: Number(bill.HFED) || 0,
                HFEN: Number(bill.HFEN) || 0,
              },
              pays: billDetails.map(detail => ({
                id_worker: detail.operationWorker.worker.id,
                pay: Number(detail.pay_unit) || 1,
              })),
            };

            // Llamar directamente a recalculateBillTotals
            await this.recalculateBillTotals(
              bill.id,
              updateBillDto,
              validateOperationID,
              bill.id_user,
              id_operation,
              bill.amount,
              bill,
            );

            // console.log(`[BillService] ✅ Recálculo completo finalizado para Bill ${bill.id}`);
          }
        } catch (error) {
          console.error(`[BillService] ❌ Error en recálculo completo:`, error);
          // No lanzar error para no bloquear la actualización básica
        }
      } else {
        console.warn(`[BillService] ⚠️ No se encontró bill para el grupo ${id_group}`);
      }

      return groupHours;
    } catch (error) {
      console.error(`[BillService] ❌ Error recalculando group_hours:`, error);
      throw new ConflictException(
        `Error al recalcular las horas del grupo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Obtiene las fechas del grupo desde los operation_worker
   */
  private async getGroupDatesFromOperationWorkers(
    operationId: number,
    groupId: string | null,
  ): Promise<{
    dateStart?: Date;
    timeStart?: string;
    dateEnd?: Date;
    timeEnd?: string;
  }> {
    if (!groupId) return {};

    try {
      // Obtener el primer operation_worker del grupo para obtener las fechas representativas
      const operationWorker = await this.prisma.operation_Worker.findFirst({
        where: {
          id_operation: operationId,
          id_group: String(groupId),
        },
        select: {
          dateStart: true,
          timeStart: true,
          dateEnd: true,
          timeEnd: true,
        },
      });

      if (!operationWorker) return {};

      return {
        dateStart: operationWorker.dateStart || undefined,
        timeStart: operationWorker.timeStart || undefined,
        dateEnd: operationWorker.dateEnd || undefined,
        timeEnd: operationWorker.timeEnd || undefined,
      };
    } catch (error) {
      console.error('[BillService] Error obteniendo fechas del grupo:', error);
      return {};
    }
  }

  /**
   * Actualiza las fechas de todos los operation_worker de un grupo específico
   */
  private async updateOperationWorkerDates(
    operationId: number,
    groupId: string,
    dateStart?: Date | string,
    timeStart?: string,
    dateEnd?: Date | string,
    timeEnd?: string,
  ): Promise<void> {
    try {
      // console.log(`[BillService] 🔧 Actualizando fechas de operation_worker para grupo ${groupId}`);
      // console.log('Fechas proporcionadas:', { dateStart, timeStart, dateEnd, timeEnd });

      // Obtener todos los operation_worker del grupo
      const operationWorkers = await this.prisma.operation_Worker.findMany({
        where: {
          id_operation: operationId,
          id_group: String(groupId),
        },
      });

      // console.log(`[BillService] 👥 Encontrados ${operationWorkers.length} trabajadores en el grupo`);

      if (operationWorkers.length === 0) {
        // console.warn(`[BillService] ⚠️ No se encontraron trabajadores para el grupo ${groupId}`);
        return;
      }

      // Preparar los datos a actualizar
      const updateData: any = {};

      const normalizedDateStart = this.normalizeGroupDateInput(dateStart, 'dateStart_group');
      const normalizedDateEnd = this.normalizeGroupDateInput(dateEnd, 'dateEnd_group');

      if (normalizedDateStart) {
        updateData.dateStart = normalizedDateStart;
        this.logger.log(
          `[BillUpdate][DateNormalization] group=${groupId} field=dateStart_group normalized=${normalizedDateStart.toISOString()}`,
        );
      }

      if (timeStart) {
        updateData.timeStart = timeStart;
        // console.log(`[BillService] ⏰ Actualizando timeStart a: ${timeStart}`);
      }

      if (normalizedDateEnd) {
        updateData.dateEnd = normalizedDateEnd;
        this.logger.log(
          `[BillUpdate][DateNormalization] group=${groupId} field=dateEnd_group normalized=${normalizedDateEnd.toISOString()}`,
        );
      }

      if (timeEnd) {
        updateData.timeEnd = timeEnd;
        // console.log(`[BillService] ⏰ Actualizando timeEnd a: ${timeEnd}`);
      }

      if (Object.keys(updateData).length === 0) {
        // console.log(`[BillService] ℹ️ No hay campos de fecha para actualizar`);
        return;
      }

      // Actualizar todos los operation_worker del grupo
      const result = await this.prisma.operation_Worker.updateMany({
        where: {
          id_operation: operationId,
          id_group: String(groupId),
        },
        data: updateData,
      });

      // console.log(`[BillService] ✅ Actualizados ${result.count} trabajadores del grupo ${groupId}`);

      // Calcular nueva duración basada en las fechas actualizadas
      if (normalizedDateStart && timeStart && normalizedDateEnd && timeEnd) {
        let startDateTime = new Date(normalizedDateStart);
        const [startHour, startMinute] = timeStart.split(':').map(Number);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        let endDateTime = new Date(normalizedDateEnd);
        const [endHour, endMinute] = timeEnd.split(':').map(Number);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Corregir fechas invertidas si es necesario
        if (startDateTime > endDateTime) {
          console.warn(`[BillService] ⚠️ Fechas invertidas detectadas, intercambiando...`);
          const tempStart = startDateTime;
          startDateTime = endDateTime;
          endDateTime = tempStart;
        }

        const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / 3_600_000;
        // console.log(`[BillService] 📊 Nueva duración calculada: ${durationHours.toFixed(2)} horas`);
      }

    } catch (error) {
      console.error(`[BillService] ❌ Error actualizando fechas del grupo ${groupId}:`, error);
      throw new ConflictException(
        `Error al actualizar las fechas del grupo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private normalizeGroupDateInput(
    value: Date | string | undefined,
    fieldName: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        this.logger.warn(
          `[BillUpdate][DateNormalization] field=${fieldName} invalid Date object recibido`,
        );
        return undefined;
      }

      return value;
    }

    const raw = String(value).trim();
    if (!raw) {
      return undefined;
    }

    const isoDate = new Date(raw);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (ddmmyyyy) {
      const [, dayText, monthText, yearText] = ddmmyyyy;
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const normalized = new Date(year, month - 1, day);

      if (
        normalized.getFullYear() === year &&
        normalized.getMonth() === month - 1 &&
        normalized.getDate() === day
      ) {
        return normalized;
      }
    }

    this.logger.warn(
      `[BillUpdate][DateNormalization] field=${fieldName} formato no reconocido: ${raw}`,
    );
    return undefined;
  }

  async remove(id: number) {
    return await this.prisma.bill.delete({
      where: { id },
    });
  }

  /**
   * Completa automáticamente una operación después de generar facturas
   * Encuentra la fecha de finalización más reciente de todos los grupos
   */
  private async completeOperationAfterBillCreation(operationId: number) {
    try {
      // console.log(`[BillService] 🎯 Completando operación ${operationId} después de generar facturas...`);
      
      // 1. Verificar si todos los grupos tienen fecha de finalización
      const allGroupsCompleted = await this.areAllGroupsCompleted(operationId);
      
      if (!allGroupsCompleted) {
        // console.log(`[BillService] ⏳ Operación ${operationId}: No todos los grupos están completados aún`);
        return;
      }

      // console.log(`[BillService] ✅ Operación ${operationId}: Todos los grupos completados, procediendo a completar operación...`);

      // 2. Encontrar la fecha más reciente de finalización
      const latestEndDateTime = await this.getLatestGroupEndDateTime(operationId);
      
      if (!latestEndDateTime) {
        console.log(`[BillService] ❌ No se pudo determinar fecha de finalización para operación ${operationId}`);
        return;
      }

      // console.log(`[BillService] 📅 Fecha de finalización más reciente: ${latestEndDateTime.date.toISOString()} ${latestEndDateTime.time}`);

      // 3. Calcular op_duration total
      const opDuration = await this.calculateOperationDuration(operationId, latestEndDateTime);

      const isSpecialOperation = await this.isSpecialOperationByTariff(operationId);

      if (isSpecialOperation) {
        const toApprovedBillStatus = 'TO_APPROVED' as BillStatus;

        await this.prisma.bill.updateMany({
          where: {
            id_operation: operationId,
            status: BillStatus.ACTIVE,
          },
          data: {
            status: toApprovedBillStatus,
          },
        });

        await this.prisma.operation.update({
          where: { id: operationId },
          data: {
            status: 'TO_APPROVED',
            dateEnd: latestEndDateTime.date,
            timeEnd: latestEndDateTime.time,
            op_duration: opDuration,
          },
        });

        return;
      }

      // 4. Actualizar operación a COMPLETED con fechas y duración (flujo normal)
      await this.prisma.operation.update({
        where: { id: operationId },
        data: {
          status: 'COMPLETED',
          dateEnd: latestEndDateTime.date,
          timeEnd: latestEndDateTime.time,
          op_duration: opDuration
        }
      });

      // 5. Liberar trabajadores
      await this.releaseOperationWorkers(operationId);

      // console.log(`[BillService] 🎉 Operación ${operationId} completada exitosamente con duración ${opDuration} horas`);
      
    } catch (error) {
      console.error(`[BillService] ❌ Error completando operación ${operationId}:`, error);
      // No lanzar error para no interrumpir la creación de facturas
    }
  }

  private async isSpecialOperationByTariff(operationId: number): Promise<boolean> {
    const specialTariffCount = await this.prisma.operation_Worker.count({
      where: {
        id_operation: operationId,
        tariff: {
          isSpecial: 'YES',
        },
      },
    });

    return specialTariffCount > 0;
  }

  /**
   * Verifica si todos los grupos de una operación están completados
   */
  private async areAllGroupsCompleted(operationId: number): Promise<boolean> {
    const incompleteWorkers = await this.prisma.operation_Worker.count({
      where: {
        id_operation: operationId,
        OR: [
          { dateEnd: null },
          { timeEnd: null }
        ]
      }
    });

    return incompleteWorkers === 0;
  }

  /**
   * Encuentra la fecha y hora más reciente de finalización de todos los grupos
   */
  private async getLatestGroupEndDateTime(operationId: number): Promise<{date: Date, time: string} | null> {
    const workers = await this.prisma.operation_Worker.findMany({
      where: {
        id_operation: operationId,
        dateEnd: { not: null },
        timeEnd: { not: null }
      },
      select: {
        dateEnd: true,
        timeEnd: true
      }
    });

    if (workers.length === 0) return null;

    let latestDateTime: Date | null = null;
    let latestResult: {date: Date, time: string} | null = null;

    for (const worker of workers) {
      if (!worker.dateEnd || !worker.timeEnd) continue;

      const [hours, minutes] = worker.timeEnd.split(':').map(Number);
      const dateTime = new Date(worker.dateEnd);
      dateTime.setHours(hours, minutes, 0, 0);

      if (!latestDateTime || dateTime > latestDateTime) {
        latestDateTime = dateTime;
        latestResult = {
          date: worker.dateEnd,
          time: worker.timeEnd
        };
      }
    }

    return latestResult;
  }

  /**
   * Calcula la duración total de la operación
   */
  private async calculateOperationDuration(operationId: number, latestEndDateTime: {date: Date, time: string}): Promise<number> {
    const operation = await this.prisma.operation.findUnique({
      where: { id: operationId },
      select: {
        dateStart: true,
        timeStrat: true
      }
    });

    if (!operation || !operation.dateStart || !operation.timeStrat) {
      return 0;
    }

    // Crear fecha de inicio
    const [startHours, startMinutes] = operation.timeStrat.split(':').map(Number);
    const startDateTime = new Date(operation.dateStart);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    // Crear fecha de fin
    const [endHours, endMinutes] = latestEndDateTime.time.split(':').map(Number);
    const endDateTime = new Date(latestEndDateTime.date);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    // Calcular duración en horas
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    return Math.max(0, Math.round(durationHours * 100) / 100); // 2 decimales, mínimo 0
  }

  /**
   * Libera todos los trabajadores de una operación
   */
  private async releaseOperationWorkers(operationId: number) {
    const workers = await this.prisma.operation_Worker.findMany({
      where: { id_operation: operationId },
      select: { id_worker: true }
    });

    const workerIds = workers.map(w => w.id_worker);
    
    if (workerIds.length > 0) {
      await this.prisma.worker.updateMany({
        where: {
          id: { in: workerIds }
        },
        data: {
          status: 'AVALIABLE'
        }
      });

      // console.log(`[BillService] 🔓 ${workerIds.length} trabajadores liberados de la operación ${operationId}`);
    }
  }

  // ========================================
  // MÉTODOS DE PAGINACIÓN SIN POOL
  // ========================================

  /**
   * Encuentra todas las bills con límite para evitar sobrecarga
   * @param limit - Número máximo de registros a retornar (máximo 50)
   * @param id_site - ID del sitio (opcional)
   * @param id_subsite - ID del subsitio (opcional)
   */
  async findAllLimited(limit: number = 20, id_site?: number, id_subsite?: number | null) {
    // Limitar el máximo a 50 para evitar sobrecarga
    const safeLimit = Math.min(limit, 50);
    
    const whereClause: any = {};

    if (id_site) {
      whereClause.operation = {
        id_site: id_site,
      };
    }

    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause.operation = {
        ...(whereClause.operation || {}),
        id_subsite: id_subsite,
      };
    }

    const bills = await this.prisma.bill.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        operation: {
          select: {
            id: true,
            dateStart: true,
            dateEnd: true,
            timeStrat: true,
            timeEnd: true,
            op_duration: true,
            motorShip: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            jobArea: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              select: {
                id: true,
                id_operation: true,
                id_worker: true,
                id_group: true,
                dateStart: true,
                dateEnd: true,
                timeStart: true,
                timeEnd: true,
                id_task: true,
                id_subtask: true,
                id_tariff: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    dni: true,
                  },
                },
                tariff: {
                  include: {
                    subTask: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit, // Limitar número de resultados
    });

    // Procesar solo las bills obtenidas (máximo 50)
    const sundayHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES_DOMINGO');
    const weekHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES');
    
    const billsWithCompensatory = await Promise.all(
      bills.map(async (bill) => {
        const compensatory = await this.calculateCompensatoryForBill(
          bill,
          sundayHoursConfig,
          weekHoursConfig
        );
        
        const groupDates = await this.getGroupDatesFromOperationWorkers(
          bill.id_operation,
          bill.id_group,
        );

        return {
          ...bill,
          op_duration: bill.operation?.op_duration,
          compensatory,
          dateStart_group: groupDates.dateStart,
          timeStart_group: groupDates.timeStart,
          dateEnd_group: groupDates.dateEnd,
          timeEnd_group: groupDates.timeEnd,
        };
      }),
    );

    return billsWithCompensatory;
  }

  /**
   * Encuentra bills con paginación basada en cursor para mejor rendimiento
   * @param cursor - Cursor para paginación (ID de la última bill)
   * @param limit - Número de registros por página
   * @param id_site - ID del sitio (opcional)
   * @param id_subsite - ID del subsitio (opcional)
   */
  async findAllPaginated(cursor?: string, limit: number = 20, id_site?: number, id_subsite?: number | null) {
    const safeLimit = Math.min(limit, 50);
    
    const whereClause: any = {};

    // Aplicar filtros de sitio y subsitio
    if (id_site) {
      whereClause.operation = {
        id_site: id_site,
      };
    }

    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause.operation = {
        ...(whereClause.operation || {}),
        id_subsite: id_subsite,
      };
    }

    // Aplicar cursor para paginación
    if (cursor) {
      const decodedCursor = parseInt(cursor);
      if (!isNaN(decodedCursor)) {
        whereClause.id = {
          lt: decodedCursor
        };
      }
    }

    const bills = await this.prisma.bill.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        operation: {
          select: {
            id: true,
            dateStart: true,
            dateEnd: true,
            timeStrat: true,
            timeEnd: true,
            op_duration: true,
            motorShip: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            jobArea: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              select: {
                id: true,
                id_operation: true,
                id_worker: true,
                id_group: true,
                dateStart: true,
                dateEnd: true,
                timeStart: true,
                timeEnd: true,
                id_task: true,
                id_subtask: true,
                id_tariff: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    dni: true,
                  },
                },
                tariff: {
                  include: {
                    subTask: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' }, // Ordenar por ID para cursor consistente
      take: safeLimit + 1, // Tomar uno extra para saber si hay más páginas
    });

    // Determinar si hay más páginas
    const hasNextPage = bills.length > safeLimit;
    const resultBills = hasNextPage ? bills.slice(0, -1) : bills;
    
    // Calcular cursor para siguiente página
    const nextCursor = hasNextPage ? resultBills[resultBills.length - 1]?.id.toString() : null;

    // Procesar bills con compensatory
    const sundayHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES_DOMINGO');
    const weekHoursConfig = await this.configurationService.findOneByName('HORAS_SEMANALES');
    
    const billsWithCompensatory = await Promise.all(
      resultBills.map(async (bill) => {
        const compensatory = await this.calculateCompensatoryForBill(
          bill,
          sundayHoursConfig,
          weekHoursConfig
        );
        
        const groupDates = await this.getGroupDatesFromOperationWorkers(
          bill.id_operation,
          bill.id_group,
        );

        return {
          ...bill,
          op_duration: bill.operation?.op_duration,
          compensatory,
          dateStart_group: groupDates.dateStart,
          timeStart_group: groupDates.timeStart,
          dateEnd_group: groupDates.dateEnd,
          timeEnd_group: groupDates.timeEnd,
        };
      }),
    );

    return {
      data: billsWithCompensatory,
      hasNextPage,
      nextCursor,
      count: resultBills.length
    };
  }

  /**
   * Cuenta el total de bills sin cargar toda la data
   */
  async countAll(id_site?: number, id_subsite?: number | null): Promise<number> {
    const whereClause: any = {};

    if (id_site) {
      whereClause.operation = {
        id_site: id_site,
      };
    }

    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause.operation = {
        ...(whereClause.operation || {}),
        id_subsite: id_subsite,
      };
    }

    return await this.prisma.bill.count({
      where: whereClause
    });
  }

  /**
   * Obtiene Bills paginadas con filtros específicos del frontend
   * @param filters Filtros de búsqueda, área, estado, fechas y paginación
   */
  async findAllPaginatedWithFilters(filters: FilterBillDto & { siteId?: number, subsiteId?: number }) {
    try {
      // console.log('🚀 [Bill Service] Parámetros completos recibidos:', {
      //   filters_completos: filters,
      //   tipo_search: typeof filters.search,
      //   valor_search: filters.search,
      //   search_length: filters.search?.length,
      //   todas_las_propiedades: Object.keys(filters)
      // });

      const {
        search,
        jobAreaId, 
        status,
        dateStart,
        dateEnd,
        page = 1,
        limit = 20,
        siteId,
        subsiteId
      } = filters;

      // Construir cláusula WHERE
      const whereClause: any = {};

      // Filtros de sitio y subsitio (desde token)
      if (siteId) {
        whereClause.operation = {
          id_site: siteId,
        };
      }

      if (typeof subsiteId === 'number' && !isNaN(subsiteId)) {
        whereClause.operation = {
          ...(whereClause.operation || {}),
          id_subsite: subsiteId,
        };
      }

      // Filtro por área
      if (jobAreaId) {
        whereClause.operation = {
          ...(whereClause.operation || {}),
          jobArea: {
            id: jobAreaId
          }
        };
      }

      // Filtro por estado
      if (status) {
        whereClause.status = status;
      }

      // Filtro por rango de fechas
      if (dateStart && dateEnd) {
        whereClause.operation = {
          ...(whereClause.operation || {}),
          dateStart: {
            gte: new Date(dateStart),
            lte: new Date(dateEnd)
          }
        };
      } else if (dateStart) {
        whereClause.operation = {
          ...(whereClause.operation || {}),
          dateStart: {
            gte: new Date(dateStart)
          }
        };
      } else if (dateEnd) {
        whereClause.operation = {
          ...(whereClause.operation || {}),
          dateStart: {
            lte: new Date(dateEnd)
          }
        };
      }

      // Filtro por búsqueda de texto - OPTIMIZADO PARA BUSCAR EN TODOS LOS REGISTROS
      if (search) {
        // console.log(`[Bill Search] Iniciando búsqueda en todos los registros por: "${search}"`);
        
        const searchAsNumber = parseInt(search);
        const isNumericSearch = !isNaN(searchAsNumber);
        
        const searchConditions: any[] = [];

        if (isNumericSearch) {
          // Buscar por ID de operación
          searchConditions.push({
            operation: {
              id: searchAsNumber
            }
          });
        } 
        
        // Siempre buscar en texto (código, subservicio, cliente)
        searchConditions.push({
          operation: {
            OR: [
              {
                client: {
                  name: { contains: search, mode: 'insensitive' }
                }
              },
              {
                jobArea: {
                  name: { contains: search, mode: 'insensitive' }
                }
              }
            ]
          }
        });

        // Buscar en billDetails -> operationWorker -> tariff (código y subservicio)
        searchConditions.push({
          billDetails: {
            some: {
              operationWorker: {
                tariff: {
                  OR: [
                    { code: { contains: search, mode: 'insensitive' } },
                    { subTask: { name: { contains: search, mode: 'insensitive' } } }
                  ]
                }
              }
            }
          }
        });

        // Combinar condiciones de búsqueda con OR
        if (Object.keys(whereClause).length > 0) {
          // Si ya hay otros filtros, agregar la búsqueda como condición adicional
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            OR: searchConditions
          });
        } else {
          // Si no hay otros filtros, usar solo la búsqueda
          whereClause.OR = searchConditions;
        }

        // console.log(`[Bill Search] Configuración de búsqueda establecida para todos los registros`);
      }

      // Configuración de paginación
      const pageNumber = Math.max(1, page);
      const itemsPerPage = Math.min(100, Math.max(1, limit));
      const skip = (pageNumber - 1) * itemsPerPage;

      // PRIMERO: Aplicar todos los filtros para obtener el total correcto
      // Esto busca en TODOS los registros disponibles que coincidan con los filtros
      // console.log(`[Bill Pagination] 🔍 BÚSQUEDA EN TODOS LOS REGISTROS DISPONIBLES`);
      // console.log(`[Bill Pagination] Aplicando filtros. Búsqueda: "${search || 'sin búsqueda'}"`);
      
      // Consultar total de items QUE COINCIDEN con los filtros (no limitado por paginación)
      const totalItems = await this.prisma.bill.count({ where: whereClause });
      
      // console.log(`[Bill Pagination] ✅ ${totalItems} registros coinciden con los filtros aplicados`);
      // console.log(`[Bill Pagination] 📄 Ahora paginar: mostrar ${limit} por página, página ${pageNumber}`);

      if (totalItems === 0) {
        // console.log(`[Bill Pagination] ⚠️ No se encontraron registros con los filtros aplicados`);
        return {
          items: [],
          pagination: {
            totalItems: 0,
            currentPage: pageNumber,
            totalPages: 0,
            itemsPerPage,
            hasNextPage: false,
            hasPreviousPage: false,
            searchApplied: Boolean(search),
            filtersApplied: Boolean(search || jobAreaId || status || dateStart || dateEnd),
            searchTerm: search || null,
            totalRecordsInDatabase: 'no-matches'
          },
        };
      }
      const bills = await this.prisma.bill.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          operation: {
            select: {
              id: true,
              dateStart: true,
              dateEnd: true,
              timeStrat: true,
              timeEnd: true,
              op_duration: true,
              motorShip: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
              jobArea: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          billDetails: {
            include: {
              operationWorker: {
                select: {
                  id: true,
                  id_operation: true,
                  id_worker: true,
                  id_group: true,
                  dateStart: true,
                  dateEnd: true,
                  timeStart: true,
                  timeEnd: true,
                  worker: {
                    select: {
                      id: true,
                      name: true,
                      dni: true,
                    },
                  },
                  tariff: {
                    include: {
                      subTask: {
                        select: {
                          id: true,
                          name: true,
                          code: true,
                        },
                      },
                      unitOfMeasure: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take: itemsPerPage,
        orderBy: { createdAt: 'desc' },
      });

      // Calcular metadatos de paginación
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // console.log(`[Bill Pagination] Resultados finales:`, {
      //   totalEncontrados: totalItems,
      //   paginaActual: pageNumber,
      //   totalPaginas: totalPages,
      //   elementosPorPagina: itemsPerPage,
      //   busqueda: search || 'sin filtro',
      //   area: jobAreaId || 'todas',
      //   estado: status || 'todos'
      // });

      return {
        items: bills,
        pagination: {
          totalItems,
          currentPage: pageNumber,
          totalPages,
          itemsPerPage,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
          // Metadatos adicionales para el frontend
          searchApplied: Boolean(search),
          filtersApplied: Boolean(search || jobAreaId || status || dateStart || dateEnd),
          searchTerm: search || null,
          totalRecordsInDatabase: totalItems > 1000 ? 'large-dataset' : 'normal-dataset'
        }
      };

    } catch (error) {
      console.error('Error en findAllPaginatedWithFilters:', error);
      throw new Error(
        `Error obteniendo bills paginadas: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Obtiene estadísticas rápidas de búsqueda sin cargar todos los datos
   * Útil para mostrar contadores en el frontend antes de cargar la página específica
   */
  async getSearchStats(
    search?: string,
    jobAreaId?: number,
    status?: Status,
    dateStart?: Date,
    dateEnd?: Date,
    userId?: number
  ) {
    const startTime = Date.now();

    // Construir filtros base
    const baseWhere: any = {};

    // Aplicar filtro de usuario si está presente
    if (userId) {
      baseWhere.operation = {
        operationWorkers: {
          some: {
            id_worker: userId
          }
        }
      };
    }

    // Aplicar filtros adicionales
    if (jobAreaId) {
      baseWhere.operation = {
        ...baseWhere.operation,
        id_area: jobAreaId
      };
    }

    if (status) {
      baseWhere.operation = {
        ...baseWhere.operation,
        status: status
      };
    }

    if (dateStart && dateEnd) {
      baseWhere.operation = {
        ...baseWhere.operation,
        date: {
          gte: dateStart,
          lte: dateEnd
        }
      };
    }

    // Aplicar búsqueda si existe
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchConditions: any[] = [];

      // Buscar por ID de operación
      const operationId = parseInt(searchTerm);
      if (!isNaN(operationId)) {
        searchConditions.push({
          operation: {
            id: operationId
          }
        });
      }

      // Buscar en nombres de clientes, áreas
      searchConditions.push(
        {
          operation: {
            client: {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          operation: {
            area: {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          }
        }
      );

      // Buscar en billDetails -> operationWorker -> tariff codes y subtasks
      searchConditions.push(
        {
          billDetails: {
            some: {
              operationWorker: {
                tariff: {
                  code: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              }
            }
          }
        },
        {
          billDetails: {
            some: {
              operationWorker: {
                SubTask: {
                  name: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              }
            }
          }
        }
      );

      baseWhere.OR = searchConditions;
    }

    // Obtener solo el conteo total
    const totalCount = await this.prisma.bill.count({
      where: baseWhere
    });

    const queryTime = Date.now() - startTime;

    // console.log(`[Bill Search Stats] Consulta completada:`, {
    //   totalEncontrados: totalCount,
    //   tiempoMs: queryTime,
    //   busqueda: search || 'sin filtro',
    //   filtrosAplicados: Boolean(search || jobAreaId || status || dateStart || dateEnd)
    // });

    return {
      totalCount,
      queryTime,
      hasLargeDataset: totalCount > 1000,
      recommendedPageSize: totalCount > 10000 ? 50 : totalCount > 1000 ? 25 : 10
    };
  }
}
