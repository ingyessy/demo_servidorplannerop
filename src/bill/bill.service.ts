import { ConflictException, Injectable } from '@nestjs/common';
import { CreateBillDto, GroupBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationFinderService } from 'src/operation/services/operation-finder.service';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { HoursCalculationService } from './services/hours-calculation.service';
import { getWeekNumber } from 'src/common/utils/dateType';

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
    const validateOperationID =
      await this.operationFinderService.getOperationWithDetailedTariffs(
        createBillDto.id_operation,
      );

    if (validateOperationID['status'] === 404) {
      return validateOperationID;
    }

    for (const group of createBillDto.groups) {
      if (!group.pays || group.pays.length === 0) {
        throw new ConflictException(
          `El grupo con ID ${group.id} no tiene asignados pagos para los trabajadores.`,
        );
      }
    }

    // Procesar grupos JORNAL
    const jornalGroups =
      await this.workerGroupAnalysisService.findGroupsByCriteria(
        validateOperationID.workerGroups,
        { unit_of_measure: 'JORNAL' },
      );

    if (jornalGroups.length > 0) {
      const operationDate = jornalGroups[0].dateRange.start;
      const calculationResults =
        this.payrollCalculationService.processJornalGroups(
          jornalGroups,
          createBillDto.groups,
          operationDate,
        );


      // Guardar cada cálculo en bill y billDetail
      for (const result of calculationResults.groupResults) {
        console.log('payRollDetails---------', JSON.stringify(result.payroll.details, null, 2));
        const additionalHours = [
          result.payroll?.details.additionalHoursDetail['HED']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HON']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HOD']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HEN']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HFED']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HFEN']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HFOD']?.hours || 0,
          result.payroll?.details.additionalHoursDetail['HFON']?.hours || 0,
        ];

        const totalAdditionalHours = additionalHours.reduce(
          (sum, h) => sum + h,
          0,
        );

        const billSaved = await this.prisma.bill.create({
          data: {
            week_number: result.week_number,
            id_operation: createBillDto.id_operation,
            id_user: userId,
            amount: 0,
            number_of_workers: result.workerCount,
            total_bill: result.billing.totalAmount,
            total_paysheet: result.payroll.totalAmount,
            number_of_hours: totalAdditionalHours,
            createdAt: new Date(),
            HED: additionalHours[0],
            HON: additionalHours[1],
            HOD: additionalHours[2],
            HEN: additionalHours[3],
            HFED: additionalHours[4],
            HFEN: additionalHours[5],
            HFOD: additionalHours[6],
            HFON: additionalHours[7],
            FAC_HED:
              result.billing?.details.additionalHoursDetail['HED']?.hours || 0,
            FAC_HON:
              result.billing?.details.additionalHoursDetail['HON']?.hours || 0,
            FAC_HOD:
              result.billing?.details.additionalHoursDetail['HOD']?.hours || 0,
            FAC_HEN:
              result.billing?.details.additionalHoursDetail['HEN']?.hours || 0,
            FAC_HFED:
              result.billing?.details.additionalHoursDetail['HFED']?.hours || 0,
            FAC_HFEN:
              result.billing?.details.additionalHoursDetail['HFEN']?.hours || 0,
            FAC_HFOD:
              result.billing?.details.additionalHoursDetail['HFOD']?.hours || 0,
            FAC_HFON:
              result.billing?.details.additionalHoursDetail['HFON']?.hours || 0,
            observation: result?.observation || '',
          },
        });

        for (const worker of result.workers || []) {
          const operationWorker = await this.prisma.operation_Worker.findFirst({
            where: {
              id_worker: worker.id,
              id_operation: createBillDto.id_operation,
            },
          });

          if (!operationWorker) {
            throw new ConflictException(
              `No se encontró el trabajador con ID: ${worker.id}`,
            );
          }

          const groupDto = createBillDto.groups.find(
            (g) => g.id === result.groupId,
          );
          if (!groupDto) {
            throw new ConflictException(
              `No se encontró el grupo con ID: ${result.groupId}`,
            );
          }

          const totalPaysheetWorker = this.calculateTotalWorker(
            result.payroll.totalAmount,
            groupDto,
            worker,
            result.workers,
          );

          const totalFacturactionWorker = this.calculateTotalWorker(
            result.billing.totalAmount,
            groupDto,
            worker,
            result.workers,
          );

          const payWorker = groupDto.pays.find(
            (p) => p.id_worker === worker.id,
          );

          await this.prisma.billDetail.create({
            data: {
              id_bill: billSaved.id,
              id_operation_worker: operationWorker.id,
              pay_rate: payWorker?.pay || 1,
              pay_unit: payWorker?.pay || 1,
              total_bill: totalFacturactionWorker,
              total_paysheet: totalPaysheetWorker,
            },
          });
        }
      }

      return {
        message: 'Cálculos JORNAL realizados con éxito',
        results: calculationResults,
      };
    }

    // Procesar grupos HORAS (sin servicio alternativo)
    const simpleHoursGroups =
      await this.workerGroupAnalysisService.findGroupsByCriteria(
        validateOperationID.workerGroups,
        {
          unit_of_measure: 'HORAS',
          alternative_paid_service: 'NO',
        },
      );

    if (simpleHoursGroups.length > 0) {
      const operationDate = simpleHoursGroups[0].dateRange.start;

      for (const group of createBillDto.groups) {
        const matchingGroupSummary = simpleHoursGroups.find(
          (summary) => summary.groupId === group.id,
        );

        if (!matchingGroupSummary) {
          throw new ConflictException(
            `No se encontró el grupo con ID: ${group.id}`,
          );
        }

        const result = await this.hoursCalculationService.processHoursGroups(
          matchingGroupSummary,
          group,
          operationDate,
        );

        const billSaved = await this.prisma.bill.create({
          data: {
            week_number: result.week_number,
            id_operation: createBillDto.id_operation,
            id_user: userId,
            amount: 0,
            number_of_workers: result.workerCount,
            total_bill: result.totalFinalFacturation,
            total_paysheet: result.totalFinalPayroll,
            number_of_hours: result.details.factHoursDistribution.totalHours,
            createdAt: new Date(),
            HED:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HED'
              ]?.hours || 0,
            HON:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HON'
              ]?.hours || 0,
            HOD:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HOD'
              ]?.hours || 0,
            HEN:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HEN'
              ]?.hours || 0,
            HFED:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HFED'
              ]?.hours || 0,
            HFEN:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HFEN'
              ]?.hours || 0,
            HFOD:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HFOD'
              ]?.hours || 0,
            HFON:
              result.details.paysheetHoursDistribution.details.hoursDetail[
                'HFON'
              ]?.hours || 0,
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
          },
        });

        for (const worker of matchingGroupSummary.workers) {
          const operationWorker = await this.prisma.operation_Worker.findFirst({
            where: {
              id_worker: worker.id,
              id_operation: createBillDto.id_operation,
            },
          });

          if (!operationWorker) {
            throw new ConflictException(
              `No se encontró el trabajador con ID: ${worker.id}`,
            );
          }

          const groupDto = createBillDto.groups.find(
            (g) => g.id === result.groupId,
          );
          if (!groupDto) {
            throw new ConflictException(
              `No se encontró el grupo con ID: ${result.groupId}`,
            );
          }

          const totalPaysheetWorker = this.calculateTotalWorker(
            result.totalFinalPayroll,
            groupDto,
            worker,
            result.workers,
          );

          const totalFacturactionWorker = this.calculateTotalWorker(
            result.totalFinalFacturation,
            groupDto,
            worker,
            result.workers,
          );

          const payWorker = groupDto.pays.find(
            (p) => p.id_worker === worker.id,
          );

          await this.prisma.billDetail.create({
            data: {
              id_bill: billSaved.id,
              id_operation_worker: operationWorker.id,
              pay_rate: payWorker?.pay || 1,
              pay_unit: payWorker?.pay || 1,
              total_bill: totalFacturactionWorker,
              total_paysheet: totalPaysheetWorker,
            },
          });
        }
      }
    }

    // Procesar grupos con servicio alternativo (alternative_paid_service: 'YES')
    const twoUnitsGroups =
      await this.workerGroupAnalysisService.findGroupsByCriteria(
        validateOperationID.workerGroups,
        { alternative_paid_service: 'YES' },
      );

    if (twoUnitsGroups.length > 0) {
      for (const group of createBillDto.groups) {
        const matchingGroupSummary = twoUnitsGroups.find(
          (summary) => summary.groupId === group.id,
        );

        if (!matchingGroupSummary) {
          throw new ConflictException(
            `No se encontró el grupo con ID: ${group.id}`,
          );
        }

        const result =
          await this.hoursCalculationService.calculateAlternativeService(
            matchingGroupSummary,
            group,
          );

        // Guardar bill principal
        const billSaved = await this.prisma.bill.create({
          data: {
            week_number: matchingGroupSummary.week_number || 0,
            id_operation: createBillDto.id_operation,
            id_user: userId,
            amount: group.amount || 0,
            number_of_workers: matchingGroupSummary.workers?.length || 0,
            total_bill: result.billingTotal || 0,
            total_paysheet: result.paysheetTotal || 0,
            number_of_hours: group.group_hours || 0,
            createdAt: new Date(),
          },
        });

        // Guardar detalle para cada trabajador
        for (const worker of matchingGroupSummary.workers) {
          const operationWorker = await this.prisma.operation_Worker.findFirst({
            where: {
              id_worker: worker.id,
              id_operation: createBillDto.id_operation,
            },
          });

          if (!operationWorker) {
            throw new ConflictException(
              `No se encontró el trabajador con ID: ${worker.id}`,
            );
          }

          const groupDto = createBillDto.groups.find(
            (g) => g.id === result.groupId,
          );
          if (!groupDto) {
            throw new ConflictException(
              `No se encontró el grupo con ID: ${result.groupId}`,
            );
          }

          const totalPaysheetWorker = this.calculateTotalWorker(
            result.paysheetTotal,
            groupDto,
            worker,
            result.workers,
          );

          const totalFacturactionWorker = this.calculateTotalWorker(
            result.billingTotal,
            groupDto,
            worker,
            result.workers,
          );

          const payWorker = groupDto.pays.find(
            (p) => p.id_worker === worker.id,
          );

          await this.prisma.billDetail.create({
            data: {
              id_bill: billSaved.id,
              id_operation_worker: operationWorker.id,
              pay_rate: payWorker?.pay || 1,
              pay_unit: payWorker?.pay || 1,
              total_bill: totalFacturactionWorker,
              total_paysheet: totalPaysheetWorker,
            },
          });
        }
      }
    }

    // Procesar grupos por cantidad (ej: CAJAS, SACOS, etc.)
    const quantityGroups = validateOperationID.workerGroups.filter(
      (group) =>
        group.unit_of_measure !== 'HORAS' &&
        group.unit_of_measure !== 'JORNAL' &&
        group.alternative_paid_service !== 'YES',
    );

    if (quantityGroups.length > 0) {
      for (const group of createBillDto.groups) {
        const matchingGroupSummary = quantityGroups.find(
          (summary) => summary.groupId === group.id,
        );

        if (!matchingGroupSummary) continue;

        const paysheetTariff =
          matchingGroupSummary.tariffDetails?.paysheet_tariff || 0;
        const facturationTariff =
          matchingGroupSummary.tariffDetails?.facturation_tariff || 0;
        const amount = group.amount || 0;
        const totalPaysheet = amount * paysheetTariff;
        const totalFacturation = amount * facturationTariff;
        const week_number = getWeekNumber(
          matchingGroupSummary.schedule?.dateStart,
        );

        // Guardar bill principal
        const billSaved = await this.prisma.bill.create({
          data: {
            week_number: week_number || 0,
            id_operation: createBillDto.id_operation,
            id_user: userId,
            amount: amount,
            number_of_workers: matchingGroupSummary.workers?.length || 0,
            total_bill: totalFacturation,
            total_paysheet: totalPaysheet,
            number_of_hours: group.group_hours || 0,
            createdAt: new Date(),
          },
        });

        // Guardar detalle para cada trabajador
        for (const worker of matchingGroupSummary.workers) {
          const operationWorker = await this.prisma.operation_Worker.findFirst({
            where: {
              id_worker: worker.id,
              id_operation: createBillDto.id_operation,
            },
          });

          if (!operationWorker) {
            throw new ConflictException(
              `No se encontró el trabajador con ID: ${worker.id}`,
            );
          }

          const groupDto = createBillDto.groups.find((g) => g.id === group.id);
          if (!groupDto) {
            throw new ConflictException(
              `No se encontró el grupo con ID: ${group.id}`,
            );
          }

          const totalUnitPays = groupDto.pays.reduce(
            (sum, p) => sum + (p.pay || 0),
            0,
          );

          const payWorker = groupDto.pays.find(
            (p) => p.id_worker === worker.id,
          );

          if (!payWorker) {
            throw new ConflictException(
              `No se encontró el pago para el trabajador con ID: ${worker.id}`,
            );
          }

          const payRate = (group.amount / totalUnitPays) * payWorker.pay;

          const totalWorkerPaysheet = this.calculateTotalWorker(
            totalPaysheet,
            groupDto,
            worker,
            matchingGroupSummary.workers,
          );

          const totalWorkerFacturation = this.calculateTotalWorker(
            totalFacturation,
            groupDto,
            worker,
            matchingGroupSummary.workers,
          );

          await this.prisma.billDetail.create({
            data: {
              id_bill: billSaved.id,
              id_operation_worker: operationWorker.id,
              pay_rate: payRate,
              pay_unit: payWorker.pay || 1,
              total_bill: totalWorkerFacturation,
              total_paysheet: totalWorkerPaysheet,
            },
          });
        }
      }
    }

    return {
      message: 'Cálculos y guardado de facturación realizados con éxito',
    };
  }

  // Función auxiliar para calcular el total_paysheet de cada trabajador
  private calculateTotalWorker(
    totalGroup: number,
    group: GroupBillDto,
    worker: any,
    workers: any[],
  ) {
    // Unidades de pago
    let payUnits = 1;
    if (Array.isArray(group.pays) && group.pays.length > 0) {
      payUnits = group.pays.reduce((sum, p) => sum + (p.pay || 0), 0);
    } else if (workers?.length) {
      payUnits = workers.length;
    }
    // Pago individual
    const payObj = Array.isArray(group.pays)
      ? group.pays.find((p) => p.id_worker === worker.id)
      : null;
    const individualPayment = payObj?.pay ?? 1;

    return (totalGroup / payUnits) * individualPayment;
  }

  async findAll() {
    const bills = await this.prisma.bill.findMany();
    return bills;
  }

  async findOne(id: number) {
    const billDB = await this.prisma.bill.findUnique({
      where: { id },
      include: {
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
                tariff: true,
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
    };
  }

  async update(id: number, updateBillDto: UpdateBillDto, userId: number) {
    const existingBill = await this.prisma.bill.findUnique({ where: { id } });
    if (!existingBill) {
      throw new ConflictException(`No se encontró la factura con ID: ${id}`);
    }

    if (!updateBillDto.id_operation) {
      throw new ConflictException(
        `No se encontró la operación con ID: ${updateBillDto.id_operation}`,
      );
    }

    // Validar operación
    const validateOperationID =
      await this.operationFinderService.getOperationWithDetailedTariffs(
        updateBillDto.id_operation,
      );
    if (validateOperationID['status'] === 404) {
      return validateOperationID;
    }

    // Validar grupos y pagos
    if (!updateBillDto.groups || updateBillDto.groups.length === 0) {
      throw new ConflictException(
        'La operación no tiene grupos de trabajadores asignados.',
      );
    }
    for (const group of updateBillDto.groups) {
      if (!group.pays || group.pays.length === 0) {
        throw new ConflictException(
          `El grupo con ID ${group.id} no tiene asignados pagos para los trabajadores.`,
        );
      }
    }

    let recalcularTotales = false;

    // Detectar si se modificó algo que afecta el total
    for (const group of updateBillDto.groups) {
      if (
        group.billHoursDistribution ||
        group.paysheetHoursDistribution ||
        typeof group.amount !== 'undefined' ||
        typeof group.group_hours !== 'undefined'
      ) {
        recalcularTotales = true;
        break;
      }
    }

    // Actualizar campos superiores si se envían
    for (const group of updateBillDto.groups) {
      const updateData: any = {
        updatedAt: new Date(),
        id_user: userId,
      };

      if (group.billHoursDistribution) {
        updateData.HOD = group.billHoursDistribution.HOD ?? existingBill.HOD;
        updateData.HON = group.billHoursDistribution.HON ?? existingBill.HON;
        updateData.HED = group.billHoursDistribution.HED ?? existingBill.HED;
        updateData.HEN = group.billHoursDistribution.HEN ?? existingBill.HEN;
        updateData.HFOD = group.billHoursDistribution.HODF ?? existingBill.HFOD;
        updateData.HFON = group.billHoursDistribution.HONF ?? existingBill.HFON;
        updateData.HFED = group.billHoursDistribution.HEDF ?? existingBill.HFED;
        updateData.HFEN = group.billHoursDistribution.HENF ?? existingBill.HFEN;
      }
      if (group.paysheetHoursDistribution) {
        updateData.FAC_HOD =
          group.paysheetHoursDistribution.HOD ?? existingBill.FAC_HOD;
        updateData.FAC_HON =
          group.paysheetHoursDistribution.HON ?? existingBill.FAC_HON;
        updateData.FAC_HED =
          group.paysheetHoursDistribution.HED ?? existingBill.FAC_HED;
        updateData.FAC_HEN =
          group.paysheetHoursDistribution.HEN ?? existingBill.FAC_HEN;
        updateData.FAC_HFOD =
          group.paysheetHoursDistribution.HODF ?? existingBill.FAC_HFOD;
        updateData.FAC_HFON =
          group.paysheetHoursDistribution.HONF ?? existingBill.FAC_HFON;
        updateData.FAC_HFED =
          group.paysheetHoursDistribution.HEDF ?? existingBill.FAC_HFED;
        updateData.FAC_HFEN =
          group.paysheetHoursDistribution.HENF ?? existingBill.FAC_HFEN;
      }

      await this.prisma.bill.update({
        where: { id },
        data: { ...updateData },
      });
    }

    // Si hay que recalcular totales, hazlo
    if (recalcularTotales) {
      let totalAmount = 0;
      let totalPaysheet = 0;
      let numberOfWorkers = 0;

      for (const group of updateBillDto.groups) {
        const matchingGroupSummary = validateOperationID.workerGroups.find(
          (summary) => summary.groupId === group.id,
        );
        if (!matchingGroupSummary) continue;

        let totalPaysheetGroup = 0;
        let totalFacturationGroup = 0;

        if (matchingGroupSummary.unit_of_measure === 'JORNAL') {
          const result = this.payrollCalculationService.processJornalGroups(
            [matchingGroupSummary],
            [group],
            matchingGroupSummary.dateRange.start,
          ).groupResults[0];
          totalPaysheetGroup = result.payroll.totalAmount;
          totalFacturationGroup = result.billing.totalAmount;
        } else if (
          matchingGroupSummary.unit_of_measure === 'HORAS' &&
          matchingGroupSummary.alternative_paid_service !== 'YES'
        ) {
          const result = await this.hoursCalculationService.processHoursGroups(
            matchingGroupSummary,
            group,
            matchingGroupSummary.dateRange.start,
          );
          totalPaysheetGroup = result.totalFinalPayroll;
          totalFacturationGroup = result.totalFinalFacturation;
        } else if (matchingGroupSummary.alternative_paid_service === 'YES') {
          const result =
            await this.hoursCalculationService.calculateAlternativeService(
              matchingGroupSummary,
              group,
            );
          totalPaysheetGroup = result.paysheetTotal;
          totalFacturationGroup = result.billingTotal;
        } else {
          const paysheetTariff =
            matchingGroupSummary.tariffDetails?.paysheet_tariff || 0;
          const facturationTariff =
            matchingGroupSummary.tariffDetails?.facturation_tariff || 0;
          const amount = group.amount || 0;
          totalPaysheetGroup = amount * paysheetTariff;
          totalFacturationGroup = amount * facturationTariff;
        }

        totalAmount += totalFacturationGroup;
        totalPaysheet += totalPaysheetGroup;
        numberOfWorkers +=
          matchingGroupSummary.workers?.length || group.pays.length;

        // Actualiza los detalles de cada trabajador
        for (const pay of group.pays) {
          const operationWorker = await this.prisma.operation_Worker.findFirst({
            where: {
              id_worker: pay.id_worker,
              id_operation:
                updateBillDto.id_operation ?? existingBill.id_operation,
            },
          });
          if (!operationWorker) continue;

          const billDetail = await this.prisma.billDetail.findFirst({
            where: {
              id_bill: id,
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

          await this.prisma.billDetail.update({
            where: { id: billDetail.id },
            data: {
              pay_rate: pay.pay ?? billDetail.pay_rate,
              pay_unit: pay.pay ?? billDetail.pay_unit,
              total_bill: totalWorkerFacturation,
              total_paysheet: totalWorkerPaysheet,
            },
          });
        }
      }

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
    } else {
      for (const group of updateBillDto.groups) {
        const matchingGroupSummary = validateOperationID.workerGroups.find(
          (summary) => summary.groupId === group.id,
        );
        if (!matchingGroupSummary) continue;

        const operationWorkers = await this.prisma.operation_Worker.findMany({
          where: {
            id_operation:
              updateBillDto.id_operation ?? existingBill.id_operation,
            id_group: group.id,
          },
        });

        // Calcula los totales del grupo según el tipo
        let totalPaysheetGroup = 0;
        let totalFacturationGroup = 0;

        if (matchingGroupSummary.unit_of_measure === 'JORNAL') {
          const result = this.payrollCalculationService.processJornalGroups(
            [matchingGroupSummary],
            [group],
            matchingGroupSummary.dateRange.start,
          ).groupResults[0];
          totalPaysheetGroup = result.payroll.totalAmount;
          totalFacturationGroup = result.billing.totalAmount;
        } else if (
          matchingGroupSummary.unit_of_measure === 'HORAS' &&
          matchingGroupSummary.alternative_paid_service !== 'YES'
        ) {
          const result = await this.hoursCalculationService.processHoursGroups(
            matchingGroupSummary,
            group,
            matchingGroupSummary.dateRange.start,
          );
          totalPaysheetGroup = result.totalFinalPayroll;
          totalFacturationGroup = result.totalFinalFacturation;
        } else if (matchingGroupSummary.alternative_paid_service === 'YES') {
          const result =
            await this.hoursCalculationService.calculateAlternativeService(
              matchingGroupSummary,
              group,
            );
          totalPaysheetGroup = result.paysheetTotal;
          totalFacturationGroup = result.billingTotal;
        } else {
          const paysheetTariff =
            matchingGroupSummary.tariffDetails?.paysheet_tariff || 0;
          const facturationTariff =
            matchingGroupSummary.tariffDetails?.facturation_tariff || 0;
          const amount = group.amount || existingBill.amount || 0;
          totalPaysheetGroup = amount * paysheetTariff;
          totalFacturationGroup = amount * facturationTariff;
        }

        // Recalcula para todos los trabajadores del grupo
        for (const operationWorker of operationWorkers) {
          const billDetail = await this.prisma.billDetail.findFirst({
            where: {
              id_bill: id,
              id_operation_worker: operationWorker.id,
            },
            include: {
              operationWorker: {
                include: {
                  worker: {
                    select: { id: true },
                  },
                },
              },
            },
          });
          if (!billDetail) continue;

          // Busca el pago actualizado en el DTO, si existe
          const pay = group.pays.find(
            (p) => p.id_worker === operationWorker.id_worker,
          );

          // Si no existe, usa el pago actual
          const payValue = pay?.pay ?? billDetail.pay_unit;

          const groupPay = operationWorkers.map((ow) => {
            // Busca el pago enviado en el DTO para este trabajador
            const payDto = group.pays.find((x) => x.id_worker === ow.id_worker);
            // Si existe en el DTO, usa ese pago, si no, usa el que ya está en la base de datos
            let payValueWorker = payDto?.pay ?? billDetail.pay_unit;
            // Si el valor es null/undefined, pon 1
            if (payValueWorker === null || payValueWorker === undefined) {
              payValueWorker = 1;
            } else {
              payValueWorker = Number(payValueWorker);
            }
            return { id_worker: ow.id_worker, pay: payValueWorker };
          });

          console.log('groupPay++++++++', groupPay);

          // Calcula el subtotal nómina y facturación para el trabajador
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

          const isCantidad =
            matchingGroupSummary.unit_of_measure !== 'HORAS' &&
            matchingGroupSummary.unit_of_measure !== 'JORNAL' &&
            matchingGroupSummary.alternative_paid_service !== 'YES';

          let payUnit;
          if (isCantidad) {
            console.log("Entra aquiii")
            // Suma de unidades de todos los trabajadores
            const totalUnidades = groupPay.reduce(
              (sum, p) => sum + (p.pay || 0),
              0,
            );
            console.log('totalUnidades', totalUnidades);
            const safeAmount = Number(group.amount) || existingBill.amount || 0;
            console.log('safeAmount', safeAmount);
            const safeTotalUnidades = Number(totalUnidades) || 1;
            console.log('safeTotalUnidades', safeTotalUnidades);
            const safePayValue =
              payValue !== null && payValue !== undefined
                ? Number(payValue)
                : 1;
            console.log('safePayValue', safePayValue);
            payUnit = (safeAmount / safeTotalUnidades) * safePayValue;
            console.log('payUnit', payUnit);
          } else {
            payUnit = payValue;
          }
          console.log('payUnit', payUnit);
          console.log("Pay value", payValue);

          await this.prisma.billDetail.update({
            where: { id: billDetail.id },
            data: {
              pay_rate: payUnit,
              pay_unit: payValue,
              total_bill: totalWorkerFacturation,
              total_paysheet: totalWorkerPaysheet,
            },
          });
        }
      }
    }

    return {
      message: 'Factura actualizada correctamente',
    };
  }

  async remove(id: number) {
    return await this.prisma.bill.delete({
      where: { id },
    });
  }
}
