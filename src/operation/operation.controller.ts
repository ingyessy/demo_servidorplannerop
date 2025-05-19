import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  NotFoundException,
  UseGuards,
  Query,
  Res,
  BadRequestException,
  ValidationPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { OperationService } from './operation.service';
import { Response } from 'express';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { StatusOperation } from '@prisma/client';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { OperationFilterDto } from './dto/fliter-operation.dto';
import { PaginatedOperationQueryDto } from './dto/paginated-operation-query.dto';
import { BooleanTransformPipe } from 'src/pipes/boolean-transform/boolean-transform.pipe';
import { WorkerAnalyticsService } from './services/workerAnalytics.service';

@Controller('operation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OperationController {
  constructor(
    private readonly operationService: OperationService,
    private readonly excelExportService: ExcelExportService,
    private readonly workerAnalyticsService: WorkerAnalyticsService,
  ) {}

  @Post()
  @UsePipes(new DateTransformPipe())
  async create(
    @Body() createOperationDto: CreateOperationDto,
    @CurrentUser('userId') userId: number,
  ) {
    createOperationDto.id_user = userId;
    console.log(createOperationDto);
    const response =
      await this.operationService.createWithWorkers(createOperationDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'excel', 'base64'],
    description:
      'Formato de respuesta: json por defecto o excel para exportación',
  })
  async findAll(
    @Query('format') format: 'json' | 'excel' | 'base64',
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.operationService.findAll();

    if (!Array.isArray(response)) {
      return response;
    }
    if (format === 'excel') {
      return this.excelExportService.exportToExcel(
        res,
        response,
        'operations',
        'Operaciones',
        'binary',
      );
    }
    if (format === 'base64') {
      return this.excelExportService.exportToExcel(
        res,
        response,
        'operations',
        'Operaciones',
        'base64',
      );
    }
    return response;
  }

  @Get('analytics/worker-distribution')
  @ApiOperation({ summary: 'Get worker distribution by hour for a specific date' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Date in YYYY-MM-DD format. Default is today.',
  })
  async getWorkerDistributionByHour(
    @Query('date', DateTransformPipe) date: Date = new Date(),
  ) {
    return this.workerAnalyticsService.getWorkerDistributionByHour(date);
  }

  @Get('analytics/worker-hours')
  @ApiOperation({ summary: 'Get monthly report of hours worked per worker' })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Month (1-12). Default is current month.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year. Default is current year.',
  })
  async getWorkerHoursReport(
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
  ) {
    return this.workerAnalyticsService.getWorkerHoursReport(month, year);
  }

  @Get('paginated')
  @ApiOperation({
    summary: 'Obtener operaciones con paginación y filtros opcionales',
  })
  @ApiQuery({
    name: 'activatePaginated',
    required: false,
    type: Boolean,
    description:
      'Si es false, devuelve todos los registros sin paginación. Por defecto: true',
  })
  async findAllPaginated(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryParams: PaginatedOperationQueryDto,
    @Query('activatePaginated', new BooleanTransformPipe(true))
    activatePaginated: boolean,
  ) {
    try {
      // Registrar el valor transformado

      // Construir el objeto de filtros
      const filters: OperationFilterDto = {};

      if (queryParams.status && queryParams.status.length > 0) {
        filters.status = queryParams.status;
      }

      if (queryParams.dateStart) {
        filters.dateStart = queryParams.dateStart;
      }

      if (queryParams.dateEnd) {
        filters.dateEnd = queryParams.dateEnd;
      }

      if (queryParams.jobAreaId && queryParams.jobAreaId > 0) {
        filters.jobAreaId = queryParams.jobAreaId;
      }

      if (queryParams.userId && queryParams.userId > 0) {
        filters.userId = queryParams.userId;
      }

      if (queryParams.inChargedId && queryParams.inChargedId > 0) {
        filters.inChargedId = queryParams.inChargedId;
      }

      if (queryParams.search && queryParams.search.trim() !== '') {
        filters.search = queryParams.search.trim();
      }

      // Obtener los datos paginados con el valor transformado
      return await this.operationService.findAllPaginated(
        queryParams.page || 1,
        queryParams.limit || 10,
        filters,
        activatePaginated, // Usar el valor transformado por el pipe
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Error processing paginated request: ${error.message}`);
    }
  }

  @Get('by-status')
  async findByStatus(
    @Query('status') statusParam: StatusOperation | StatusOperation[],
  ) {
    // Si no se proporciona un parámetro, usar los estados por defecto
    const statuses = statusParam
      ? Array.isArray(statusParam)
        ? statusParam
        : [statusParam]
      : [StatusOperation.INPROGRESS, StatusOperation.PENDING];

    // Validar que todos los estados sean del enum StatusOperation
    const validStatuses = Object.values(StatusOperation);
    const filteredStatuses = statuses.filter((status) =>
      validStatuses.includes(status as StatusOperation),
    ) as StatusOperation[];

    // Si después de filtrar no quedan estados válidos, usar los por defecto
    const statusesToUse =
      filteredStatuses.length > 0
        ? filteredStatuses
        : [StatusOperation.INPROGRESS, StatusOperation.PENDING];

    const response =
      await this.operationService.findActiveOperations(statusesToUse);

    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }

    return response;
  }

  @Get('by-date')
  async findByDate(
    @Query('dateStart', DateTransformPipe) dateStart: Date,
    @Query('dateEnd', DateTransformPipe) dateEnd: Date,
  ) {
    const response = await this.operationService.findOperationRangeDate(
      dateStart,
      dateEnd,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get('by-user')
  async findByWorker(@CurrentUser('userId') id: number) {
    const response = await this.operationService.findOperationByUser(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get('by-worker/:id')
  async findByWorkerId(@Param('id', ParseIntPipe) id: number) {
    const response = await this.operationService.findByWorker(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.operationService.findOne(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  @UsePipes(new DateTransformPipe())
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOperationDto: UpdateOperationDto,
  ) {
    const response = await this.operationService.update(id, updateOperationDto);
    if (response && response['status'] === 404) {
      throw new NotFoundException(response['messsge']);
    }
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.operationService.remove(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
}
