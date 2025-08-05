import { ConflictException, Injectable } from '@nestjs/common';
import { CreateBillDto, GroupBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationFinderService } from 'src/operation/services/operation-finder.service';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { HoursCalculationService } from './services/hours-calculation.service';
import { getWeekNumber } from 'src/common/utils/dateType';
import { group } from 'console';

@Injectable()
export class BillService {
  constructor(
    private prisma: PrismaService,
    private operationFinderService: OperationFinderService,
    private workerGroupAnalysisService: WorkerGroupAnalysisService,
    private payrollCalculationService: PayrollCalculationService,
    private hoursCalculationService: HoursCalculationService,
  ) {}
async create(createBillDto: CreateBillDto, userId: number) {
    const validateOperationID = await this.validateOperation(createBillDto.id_operation);
    if (validateOperationID['status'] === 404) {
      return validateOperationID;
    }

    // Procesar todos los tipos de grupos
    await this.processJornalGroups(createBillDto, userId, validateOperationID);
    await this.processSimpleHoursGroups(createBillDto, userId, validateOperationID);
    await this.processAlternativeServiceGroups(createBillDto, userId, validateOperationID);
    await this.processQuantityGroups(createBillDto, userId, validateOperationID, 0);

    return {
      message: 'Cálculos y guardado de facturación realizados con éxito',
    };
  }

  // Validar operación
  private async validateOperation(operationId: number) {
    return await this.operationFinderService.getOperationWithDetailedTariffs(operationId);
  }

  // Procesar grupos JORNAL
  private async processJornalGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
  ) {
    const jornalGroups = await this.workerGroupAnalysisService.findGroupsByCriteria(
      validateOperationID.workerGroups,
      { unit_of_measure: 'JORNAL', alternative_paid_service: 'NO' },
    );

    const jornalGroupsFiltered = jornalGroups.filter((jg) =>
      createBillDto.groups.some((g) => String(g.id) === String(jg.groupId)),
    );

    if (jornalGroupsFiltered.length === 0) return;

    const operationDate = jornalGroups[0].dateRange.start;
    const calculationResults = this.payrollCalculationService.processJornalGroups(
      jornalGroupsFiltered,
      createBillDto.groups,
      operationDate,
    );

    for (const result of calculationResults.groupResults) {
      const groupDto = this.getGroupDto(createBillDto.groups, result.groupId);
      const billData = this.prepareBillData(result, createBillDto.id_operation, userId, groupDto);
      const billSaved = await this.prisma.bill.create({ data: billData });
      
      await this.processBillDetails(result.workers, billSaved.id, createBillDto.id_operation, groupDto, result);
    }
  }

  // Procesar grupos HORAS (sin servicio alternativo)
  private async processSimpleHoursGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
  ) {
    const simpleHoursGroups = await this.workerGroupAnalysisService.findGroupsByCriteria(
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

    const operationDate = simpleHoursGroupsFiltered[0].dateRange.start;

    for (const matchingGroupSummary of simpleHoursGroupsFiltered) {
      const group = createBillDto.groups.find(
        (g) => String(g.id).trim() === String(matchingGroupSummary.groupId).trim(),
      );
      if (!group) continue;

      const result = await this.hoursCalculationService.processHoursGroups(
        matchingGroupSummary,
        group,
      );

      const billData = this.prepareHoursBillData(result, createBillDto.id_operation, userId);
       const billSaved = await this.prisma.bill.create({ 
      data: {
        ...billData
      }
    });

      await this.processHoursBillDetails(
        matchingGroupSummary.workers,
        billSaved.id,
        createBillDto.id_operation,
        group,
        result,
      );
    }
  }

  // Procesar grupos con servicio alternativo
  private async processAlternativeServiceGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
  ) {
    const twoUnitsGroups = await this.workerGroupAnalysisService.findGroupsByCriteria(
      validateOperationID.workerGroups,
      { alternative_paid_service: 'YES' },
    );

    const twoUnitsGroupsFiltered = twoUnitsGroups.filter((tug) =>
      createBillDto.groups.some((g) => String(g.id) === String(tug.groupId)),
    );

    if (twoUnitsGroupsFiltered.length === 0) return;


    for (const matchingGroupSummary of twoUnitsGroupsFiltered) {
      const group = createBillDto.groups.find(
        (g) => String(g.id).trim() === String(matchingGroupSummary.groupId).trim(),
      );
      if (!group) continue;

      const { totalFacturation, totalPaysheet } = await this.calculateAlternativeServiceTotals(
        matchingGroupSummary,
        group,
      );

      const billData = this.prepareAlternativeServiceBillData(
        matchingGroupSummary,
        group,
        totalFacturation,
        totalPaysheet,
        createBillDto.id_operation,
        userId,
      );

      const billSaved = await this.prisma.bill.create({ data: {...billData, group_hours: group.group_hours} });

      await this.processAlternativeServiceBillDetails(
        matchingGroupSummary.workers,
        billSaved.id,
        createBillDto.id_operation,
        group,
        totalFacturation,
        totalPaysheet,
        matchingGroupSummary,
      );
    }
  }

    private async processQuantityGroups(
    createBillDto: CreateBillDto,
    userId: number,
    validateOperationID: any,
    amountDb: number
  ) {
    // Si validateOperationID es un array de grupos, úsalo directamente
    const groupsSource = Array.isArray(validateOperationID.workerGroups)
      ? validateOperationID.workerGroups
      : validateOperationID;
  
    const quantityGroups = groupsSource.filter(
      (group) =>
        group.schedule.unit_of_measure !== 'HORAS' &&
        group.schedule.unit_of_measure !== 'JORNAL' &&
        (
          // Acepta null o undefined en cualquiera de los dos campos
          (group.schedule.id_facturation_unit === null || group.schedule.id_facturation_unit === undefined) &&
          (
            !group.tariffDetails?.facturationUnit ||
            group.tariffDetails?.facturationUnit === null
          )
        )
    );
  
    const quantityGroupsFiltered = quantityGroups.filter((qg) =>
      createBillDto.groups.some((g) => String(g.id) === String(qg.groupId)),
    );
  
    if (quantityGroupsFiltered.length === 0) return;
  
    for (const group of createBillDto.groups) {
      const matchingGroupSummary = quantityGroupsFiltered.find(
        (summary) => summary.groupId === group.id,
      );
      if (!matchingGroupSummary) continue;
  
      const { totalPaysheet, totalFacturation } = this.calculateQuantityTotals(
        matchingGroupSummary,
        group,
           amountDb
      );
  
      const billData = this.prepareQuantityBillData(
        matchingGroupSummary,
        group,
        totalPaysheet,
        totalFacturation,
        createBillDto.id_operation,
        userId,
      );
  
      const billSaved = await this.prisma.bill.create({ data: billData });
  
      await this.processQuantityBillDetails(
        matchingGroupSummary.workers,
        billSaved.id,
        createBillDto.id_operation,
        group,
        totalPaysheet,
        totalFacturation,
        matchingGroupSummary,
      );
    }
  }

  // Calcular totales para servicio alternativo
  private async calculateAlternativeServiceTotals(matchingGroupSummary: any, group: GroupBillDto) {

    const facturationUnit =matchingGroupSummary.facturation_unit || matchingGroupSummary.schedule.facturation_unit || matchingGroupSummary.schedule.unit_of_measure;
    const facturationTariff = matchingGroupSummary.facturation_tariff || matchingGroupSummary.tariffDetails.facturation_tariff || 0;
    const paysheetUnit =  matchingGroupSummary.unit_of_measure || matchingGroupSummary.schedule.unit_of_measure;
    const paysheetTariff = matchingGroupSummary.paysheet_tariff || matchingGroupSummary.tariffDetails.paysheet_tariff || 0;


    let totalFacturation = 0;
    let totalPaysheet = 0;

    // Calcular facturación
    if (facturationUnit === 'HORAS' || facturationUnit === 'JORNAL') {

      if(matchingGroupSummary.group_tariff  === 'YES') {
        const factResult = group.group_hours * (matchingGroupSummary.facturation_tariff || 0);
        totalFacturation = factResult;
      }
      else if (facturationUnit === 'HORAS') {
        const factResult = await this.hoursCalculationService.processHoursGroups(
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
      const paysheetResult = await this.hoursCalculationService.processHoursGroups(
        matchingGroupSummary,
        group,
      );
      totalPaysheet = paysheetResult.totalFinalPayroll;

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
      console.log("Amount:", amount, "Paysheet Tariff:", paysheetTariff);
    }

    return { totalFacturation, totalPaysheet };
  }

  // Calcular totales para grupos por cantidad
  private calculateQuantityTotals(matchingGroupSummary: any, group: GroupBillDto, amountDb: number) {
    const paysheetTariff = matchingGroupSummary.tariffDetails?.paysheet_tariff || 0;
    const facturationTariff = matchingGroupSummary.tariffDetails?.facturation_tariff || 0;
    const amount = group.amount || amountDb || 0;
    return {
      totalPaysheet: amount * paysheetTariff,
      totalFacturation: amount * facturationTariff,
    };
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
  private prepareBillData(result: any, operationId: number, userId: number, groupDto: GroupBillDto) {
    const additionalHours = [
      groupDto.paysheetHoursDistribution.HED || 0,
      0, 0,
      groupDto.paysheetHoursDistribution.HEN || 0,
      groupDto.paysheetHoursDistribution.HFED || 0,
      groupDto.paysheetHoursDistribution.HFEN || 0,
      0, 0,
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
  private prepareHoursBillData(result: any, operationId: number, userId: number) {
    return {
      week_number: result.week_number,
      id_operation: operationId,
      id_user: userId,
      amount: 0,
      number_of_workers: result.workerCount,
      total_bill: result.totalFinalFacturation,
      total_paysheet: result.totalFinalPayroll,
      number_of_hours: result.details.factHoursDistribution.totalHours,
      createdAt: new Date(),
      HED: result.details.paysheetHoursDistribution.details.hoursDetail['HED']?.hours || 0,
      HON: result.details.paysheetHoursDistribution.details.hoursDetail['HON']?.hours || 0,
      HOD: result.details.paysheetHoursDistribution.details.hoursDetail['HOD']?.hours || 0,
      HEN: result.details.paysheetHoursDistribution.details.hoursDetail['HEN']?.hours || 0,
      HFED: result.details.paysheetHoursDistribution.details.hoursDetail['HFED']?.hours || 0,
      HFEN: result.details.paysheetHoursDistribution.details.hoursDetail['HFEN']?.hours || 0,
      HFOD: result.details.paysheetHoursDistribution.details.hoursDetail['HFOD']?.hours || 0,
      HFON: result.details.paysheetHoursDistribution.details.hoursDetail['HFON']?.hours || 0,
      FAC_HED: result.details.factHoursDistribution.details.hoursDetail['HED']?.hours || 0,
      FAC_HON: result.details.factHoursDistribution.details.hoursDetail['HON']?.hours || 0,
      FAC_HOD: result.details.factHoursDistribution.details.hoursDetail['HOD']?.hours || 0,
      FAC_HEN: result.details.factHoursDistribution.details.hoursDetail['HEN']?.hours || 0,
      FAC_HFED: result.details.factHoursDistribution.details.hoursDetail['HFED']?.hours || 0,
      FAC_HFEN: result.details.factHoursDistribution.details.hoursDetail['HFEN']?.hours || 0,
      FAC_HFOD: result.details.factHoursDistribution.details.hoursDetail['HFOD']?.hours || 0,
      FAC_HFON: result.details.factHoursDistribution.details.hoursDetail['HFON']?.hours || 0,
      id_group: result.groupId,
    };
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
    const facturationUnit = matchingGroupSummary.facturation_unit || matchingGroupSummary.unit_of_measure;
    const paysheetUnit = matchingGroupSummary.unit_of_measure;
    const week_number = matchingGroupSummary.dateRange.start 
      ? getWeekNumber(new Date(matchingGroupSummary.dateRange.start))
      : 0;

    const paysheetTotalHours = group.paysheetHoursDistribution
      ? Object.values(group.paysheetHoursDistribution).reduce((acc: number, hours: number) => acc + hours, 0)
      :  0;
    const billTotalHours = group.billHoursDistribution
      ? Object.values(group.billHoursDistribution).reduce((acc: number, hours: number) => acc + hours, 0)
      :  0;

    const numberHours = paysheetTotalHours || billTotalHours || 0;

    return {
      week_number: week_number || 0,
      id_operation: operationId,
      id_user: userId,
      amount: group.amount || 0,
      number_of_workers: matchingGroupSummary.workers?.length || 0,
      total_bill: totalFacturation,
      total_paysheet: totalPaysheet,
      number_of_hours: numberHours,
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

    return {
      week_number: week_number || 0,
      id_operation: operationId,
      id_user: userId,
      amount: group.amount || 0,
      number_of_workers: matchingGroupSummary.workers?.length || 0,
      total_bill: totalFacturation,
      total_paysheet: totalPaysheet,
      number_of_hours: group.group_hours || 0,
      createdAt: new Date(),
      id_group: matchingGroupSummary.groupId,
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
    for (const worker of workers || []) {
      const operationWorker = await this.findOperationWorker(worker.id, operationId);
      
      const totalPaysheetWorker = this.calculateTotalWorker(
        result.payroll.totalAmount,
        groupDto,
        worker,
        workers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        result.billing.totalAmount,
        groupDto,
        worker,
        workers,
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

  // Procesar detalles para grupos HORAS
  private async processHoursBillDetails(
    workers: any[],
    billId: number,
    operationId: number,
    group: GroupBillDto,
    result: any,
  ) {
    for (const worker of workers) {
      const operationWorker = await this.findOperationWorker(worker.id, operationId);
      const groupDto = this.getGroupDto([group], result.groupId);

      const totalPaysheetWorker = this.calculateTotalWorker(
        result.totalFinalPayroll,
        groupDto,
        worker,
        workers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        result.totalFinalFacturation,
        groupDto,
        worker,
        workers,
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
    const facturationUnit = matchingGroupSummary.facturation_unit || matchingGroupSummary.unit_of_measure;

    for (const worker of workers) {
      const operationWorker = await this.findOperationWorker(worker.id, operationId);

      const totalPaysheetWorker = this.calculateTotalWorker(
        totalPaysheet,
        group,
        worker,
        workers,
      );

      const totalFacturactionWorker = this.calculateTotalWorker(
        totalFacturation,
        group,
        worker,
        workers,
      );

      const payWorker = group.pays?.find((p) => p.id_worker === worker.id);

      let payRate;
      if (facturationUnit !== 'HORAS' && facturationUnit !== 'JORNAL') {
        const totalUnitPays = group.pays?.reduce((sum, p) => sum + (p.pay || 0), 0) || 1;
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
    for (const worker of workers) {
      const operationWorker = await this.findOperationWorker(worker.id, operationId);

      const totalUnitPays = group.pays.reduce((sum, p) => sum + (p.pay || 0), 0);
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
        workers,
      );

      const totalWorkerFacturation = this.calculateTotalWorker(
        totalFacturation,
        group,
        worker,
        workers,
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
  private async findOperationWorker(workerId: number, operationId: number) {
    const operationWorker = await this.prisma.operation_Worker.findFirst({
      where: {
        id_worker: workerId,
        id_operation: operationId,
      },
    });

    if (!operationWorker) {
      throw new ConflictException(
        `No se encontró el trabajador con ID: ${workerId}`,
      );
    }

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

    return (totalGroup / payUnits) * individualPayment;
  }
  async findAll() {
    const bills = await this.prisma.bill.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              include: {
                worker: {
                  select: {
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
    return bills;
  }

  async findOne(id: number) {
    const billDB = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        billDetails: {
          include: {
            operationWorker: {
              include: {
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

    // Mapeo para que la respuesta tenga la misma estructura que el DTO
    return {
      ...billDB,
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
      pays: billDB.billDetails.map(detail => ({
        id_worker: detail.operationWorker.worker.id,
        pay: detail.pay_unit,
        pay_rate: detail.pay_rate,
      })),
    };
  }

   async update(id: number, updateBillDto: UpdateBillDto, userId: number) {
    console.log("Update Bill DTO:", JSON.stringify(updateBillDto, null, 2));
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
  
    const validateOperationID = await this.validateOperation(billDb.id_operation);
  
    if (validateOperationID['status'] === 404) {
      throw new ConflictException(`No se encontró la operación con ID: ${billDb.id_operation}`);
    } 

  
  
    this.validateUpdateGroups([updateBillDto]);
  
    const recalcularTotales = this.shouldRecalculateTotals([updateBillDto]);
  
    await this.updateBillFields(id, [updateBillDto], existingBill, userId);
  
    if (recalcularTotales) {
      await this.recalculateBillTotals(id, updateBillDto, validateOperationID, userId, billDb.id_operation, billDb.amount);
    } else {
      await this.updateBillDetailsOnly(id, updateBillDto, validateOperationID, existingBill, billDb.id_operation);
    }
  
    const billDB = await this.findOne(id);
  }
  
  private validateUpdateGroups(groups: GroupBillDto[]) {
    if (!groups || groups.length === 0) {
      throw new ConflictException('La operación no tiene grupos de trabajadores asignados.');
    }
    for (const group of groups) {
      if (!group.pays || group.pays.length === 0) {
        throw new ConflictException(
          `El grupo con ID ${group} no tiene asignados pagos para los trabajadores.`,
        );
      }
    }
  }
  
  private shouldRecalculateTotals(groups: GroupBillDto[]): boolean {
    return groups.some(group => 
      group.billHoursDistribution ||
      group.paysheetHoursDistribution ||
      typeof group.amount !== 'undefined' ||
      typeof group.group_hours !== 'undefined'
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
    
        let finalNumberOfHours: number | undefined = undefined;
    
        // Procesar billHoursDistribution (FACTURACIÓN)
        if (group.billHoursDistribution) {
          
          // Calcular el total de horas de facturación
          const billTotalHours = Object.values(group.billHoursDistribution).reduce(
            (acc: number, hours: number) => acc + (hours || 0), 
            0
          );
    
    
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
            const paysheetTotalHours = Object.values(group.paysheetHoursDistribution).reduce(
              (acc: number, hours: number) => acc + (hours || 0), 
              0
            );
            finalNumberOfHours = paysheetTotalHours || finalNumberOfHours;
          }
        }
    
    
        // Aplicar el número de horas final
        if (finalNumberOfHours !== undefined) {
          updateData.number_of_hours = finalNumberOfHours;
        }
    
        console.log("Final number of hours:", finalNumberOfHours);
        console.log("Update data for bill:", updateData);
    
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
    amountDb: number
  ) {
    let totalAmount = 0;
    let totalPaysheet = 0;
    let numberOfWorkers = 0;

    if(!group){
      throw new ConflictException('No se proporcionaron grupos para actualizar la factura.');
    }
  
      const matchingGroupSummary = validateOperationID.workerGroups.find(
        (summary) => summary.groupId === group.id,
      );
      if (!matchingGroupSummary) {
        throw new ConflictException(`No se encontró el grupo con ID: ${group.id} en la operación.`);
      }
  
      const { totalPaysheetGroup, totalFacturationGroup } = await this.calculateGroupTotalsForUpdate(
        matchingGroupSummary,
        group,
        amountDb
      );
  
      totalAmount += totalFacturationGroup;
      totalPaysheet += totalPaysheetGroup;
      numberOfWorkers += matchingGroupSummary.workers?.length || group.pays.length;
  
      await this.updateWorkerDetails(id, group, matchingGroupSummary, totalPaysheetGroup, totalFacturationGroup, id_operation);
  
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
  
  private async calculateGroupTotalsForUpdate(matchingGroupSummary: any, group: GroupBillDto, amountDb: number) {
    let totalPaysheetGroup = 0;
    let totalFacturationGroup = 0;
  
    if (matchingGroupSummary.schedule.unit_of_measure === 'JORNAL') {
      const result = this.payrollCalculationService.processJornalGroups(
        [matchingGroupSummary],
        [group],
        matchingGroupSummary.dateRange.start,
      ).groupResults[0];
      totalPaysheetGroup = result.payroll.totalAmount;
      totalFacturationGroup = result.billing.totalAmount;
    } else if (
      matchingGroupSummary.schedule.unit_of_measure === 'HORAS' &&
      matchingGroupSummary.tariffDetails.alternative_paid_service !== 'YES'
    ) {
      const result = await this.hoursCalculationService.processHoursGroups(
        matchingGroupSummary,
        group,
      );
      totalPaysheetGroup = result.totalFinalPayroll;
      totalFacturationGroup = result.totalFinalFacturation;
    } else if (matchingGroupSummary.tariffDetails.alternative_paid_service === 'YES') {
      const { totalFacturation, totalPaysheet } = await this.calculateAlternativeServiceTotals(
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
  ) {
    for (const pay of group.pays) {
      const operationWorker = await this.prisma.operation_Worker.findFirst({
        where: {
          id_worker: pay.id_worker,
          id_operation: operationId || billId,
        },
      });
      if (!operationWorker) continue;
  
      const billDetail = await this.prisma.billDetail.findFirst({
        where: {
          id_bill: billId,
          id_operation_worker: operationWorker.id,
        },
      });
      if (!billDetail) continue;
  
      const totalWorkerPaysheet = this.calculateTotalWorker(
        totalPaysheetGroup,
        group,
        { id: pay.id_worker },
        matchingGroupSummary.workers,
      );
      const totalWorkerFacturation = this.calculateTotalWorker(
        totalFacturationGroup,
        group,
        { id: pay.id_worker },
        matchingGroupSummary.workers,
      );
  
      // Construir groupPay para el cálculo del pay_rate
      const groupPay = group.pays.map(p => ({
        id_worker: p.id_worker,
        pay: p.pay
      }));
  
      // USAR la función calculatePayRateForWorker en lugar de lógica manual
      const payRate = this.calculatePayRateForWorker(
        matchingGroupSummary,
        group,
        groupPay,
        Number(pay.pay),
        { amount: group.amount || 0 }, // existingBill simulado
      );
  
  
      await this.prisma.billDetail.update({
        where: { id: billDetail.id },
        data: {
          pay_rate: payRate,
          pay_unit: pay.pay ?? billDetail.pay_unit,
          total_bill: totalWorkerFacturation,
          total_paysheet: totalWorkerPaysheet,
        },
      });
    }
  }
  
  private async updateBillDetailsOnly(
    id: number,
    updateBillDto: UpdateBillDto,
    validateOperationID: any,
    existingBill: any,
    id_operation: number,
  ) {
    if (!updateBillDto) {
      throw new ConflictException('No se proporcionaron grupos para actualizar la factura.');
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
      const { totalPaysheetGroup, totalFacturationGroup } = await this.getExistingOrCalculateGroupTotals(
        matchingGroupSummary,
        group,
        existingBill,
        existingBill.amount
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
    amountDb: number
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
      const { totalFacturation, totalPaysheet } = await this.calculateAlternativeServiceTotals(
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
        amountDb
      );
      totalPaysheetGroup = totalPaysheet;
      totalFacturationGroup = totalFacturation;
    }
  
    return { totalPaysheetGroup, totalFacturationGroup };
  }

  private buildGroupPayArray(billDetails: any[], group: GroupBillDto) {
    return billDetails.map((bd) => {
      const payDto = group.pays.find((x) => x.id_worker === bd.operationWorker.worker.id);
      let payValueWorker = payDto?.pay ?? (bd.pay_unit || 1); // Valor por defecto si no se encuentra el pago
      if (payValueWorker === null || payValueWorker === undefined) {
        payValueWorker = 1;
      }
      return { id_worker: bd.operationWorker.worker.id, pay: Number(payValueWorker) };
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
      const pay = group.pays.find((p) => p.id_worker === operationWorker.id_worker);
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

      if(!payValue) {
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
    const scheduleUnitOfMeasure = matchingGroupSummary.schedule?.unit_of_measure;
    
    // Detectar servicio alternativo
    const isAlternativeService = tariffDetails?.alternative_paid_service === 'YES';
    
    // Detectar grupo de cantidad (no HORAS, no JORNAL, sin servicio alternativo)
    const isQuantityGroup = 
      scheduleUnitOfMeasure !== 'HORAS' &&
      scheduleUnitOfMeasure !== 'JORNAL' &&
      !isAlternativeService &&
      !tariffDetails?.facturationUnit;
    
    // Detectar grupo de horas simples (HORAS sin servicio alternativo)
    const isSimpleHoursGroup = 
      scheduleUnitOfMeasure === 'HORAS' && 
      !isAlternativeService;
    
    // Detectar grupo jornal (JORNAL sin servicio alternativo)
    const isJornalGroup = 
      scheduleUnitOfMeasure === 'JORNAL' && 
      !isAlternativeService;
  
 
  
    if (isAlternativeService) {
      const facturationUnit = tariffDetails?.facturationUnit?.name || 
                            matchingGroupSummary.facturation_unit || 
                            scheduleUnitOfMeasure;
      
      if (facturationUnit !== 'HORAS' && facturationUnit !== 'JORNAL') {
        const totalUnitPays = groupPay.reduce((sum, p) => sum + (p.pay || 0), 0);
        const safeAmount = Number(group.amount) || existingBill.amount || 0;
        const safeTotalUnidades = Number(totalUnitPays) || 1;
        const safePayValue = payValue !== null && payValue !== undefined ? Number(payValue) : 1;
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
      const safePayValue = payValue !== null && payValue !== undefined ? Number(payValue) : 1;
      const result = (safeAmount / safeTotalUnidades) * safePayValue;
      return result;
    } else if (isSimpleHoursGroup || isJornalGroup) {
      // Para grupos de HORAS y JORNAL simples, pay_rate = payValue
      return payValue;
    }
  
    // Fallback: retornar payValue
    return payValue;
  }
  async remove(id: number) {
    return await this.prisma.bill.delete({
      where: { id },
    });
  }
}
