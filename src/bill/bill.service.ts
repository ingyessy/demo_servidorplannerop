import { ConflictException, Injectable } from '@nestjs/common';
import { CreateBillDto, GroupBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationFinderService } from 'src/operation/services/operation-finder.service';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { HoursCalculationService } from './services/hours-calculation.service';

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



          const groupDto = createBillDto.groups.find(g => g.id === result.groupId);
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



          const groupDto = createBillDto.groups.find(g => g.id === result.groupId);
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



          const groupDto = createBillDto.groups.find(g => g.id === result.groupId);
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

        // Guardar bill principal
        const billSaved = await this.prisma.bill.create({
          data: {
            week_number: matchingGroupSummary.week_number || 0,
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
            throw new ConflictException(`No se encontró el trabajador con ID: ${worker.id}`);
          }

          const groupDto = createBillDto.groups.find(g => g.id === group.id);
          if (!groupDto) {
            throw new ConflictException(
              `No se encontró el grupo con ID: ${group.id}`,
            );
          }

          const  totalUnitPays = groupDto.pays.reduce((sum, p) => sum + (p.pay || 0), 0);

          const payWorker = groupDto.pays.find(
            (p) => p.id_worker === worker.id,
          );

          if (!payWorker) {
            throw new ConflictException(
              `No se encontró el pago para el trabajador con ID: ${worker.id}`,
            );
          }

          const payRate = group.amount / totalUnitPays * payWorker.pay;

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
    console.log('Calculando total para el trabajador:',  group);
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
    return await this.prisma.bill.findUnique({
      where: { id },
      include:{
        billDetails: {
          include: {
            operationWorker: {
              include: {
                 tariff: true,
              },
            },
          },
        },
      },
    });
  }
  

  async update(id: number, updateBillDto: UpdateBillDto) {
    return await this.prisma.bill.update({
      where: { id },
      data: updateBillDto,
    });
  }

  async remove(id: number) {
    return await this.prisma.bill.delete({
      where: { id },
    });
  }
}
