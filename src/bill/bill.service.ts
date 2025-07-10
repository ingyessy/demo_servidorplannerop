import { Injectable } from '@nestjs/common';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OperationFinderService } from 'src/operation/services/operation-finder.service';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';

@Injectable()
export class BillService {
  constructor(
    private prisma: PrismaService,
    private operationFinderService: OperationFinderService,
    private workerGroupAnalysisService: WorkerGroupAnalysisService,
    private payrollCalculationService: PayrollCalculationService,
  ) {}
  async create(createBillDto: CreateBillDto) {
    const validateOperationID =
      await this.operationFinderService.getOperationWithDetailedTariffs(
        createBillDto.id_operation,
      );
    if (validateOperationID['status'] === 404) {
      return validateOperationID;
    }

    const jornalGroups = await this.workerGroupAnalysisService.findGroupsByCriteria(
      validateOperationID.workerGroups,
      {
        unit_of_measure: 'JORNAL',
      },
    );
    console.log(jornalGroups, 'jornalGroups');

    if (jornalGroups.length > 0) {
      const operationDate = jornalGroups[0].dateRange.start
        ? jornalGroups[0].dateRange.start
        : jornalGroups[0].dateRange.start;

      const additionalHoursByGroup = createBillDto.additionalHours || {};

      // Calcular totales
      const calculationResults = this.payrollCalculationService.calculateTotals(
        jornalGroups,
        additionalHoursByGroup,
        operationDate,
      );

      return {
        message: 'Cálculos realizados con éxito',
        results: calculationResults,
      };
    }
    return 'This action adds a new bill';
  }

  findAll() {
    return `This action returns all bill`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bill`;
  }

  update(id: number, updateBillDto: UpdateBillDto) {
    return `This action updates a #${id} bill`;
  }

  remove(id: number) {
    return `This action removes a #${id} bill`;
  }
}
