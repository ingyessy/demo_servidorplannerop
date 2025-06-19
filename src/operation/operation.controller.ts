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
  ConflictException,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { OperationService } from './operation.service';
import { Response } from 'express';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Role, StatusOperation } from '@prisma/client';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { OperationFilterDto } from './dto/fliter-operation.dto';
import { PaginatedOperationQueryDto } from './dto/paginated-operation-query.dto';
import { BooleanTransformPipe } from 'src/pipes/boolean-transform/boolean-transform.pipe';
import { WorkerAnalyticsService } from './services/workerAnalytics.service';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { WorkerDistributionQueryDto } from './dto/worker-distribution-query.dto';
import { getColombianDateTime } from 'src/common/utils/dateColombia';
import { WorkerHoursReportQueryDto } from './dto/worker-hours-report-query.dto';
@Controller('operation')
@UseInterceptors(SiteInterceptor)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERVISOR, Role.ADMIN, Role.SUPERADMIN)
@ApiBearerAuth('access-token')
export class OperationController {
  constructor(
    private readonly operationService: OperationService,
    private readonly excelExportService: ExcelExportService,
    private readonly workerAnalyticsService: WorkerAnalyticsService,
  ) {}

  @Post()
  @UsePipes(new DateTransformPipe())
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createOperationDto: CreateOperationDto,
    @CurrentUser('userId') userId: number,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('isAdmin') isAdmin: boolean,
  ) {
    if (!isSuperAdmin) {
      if (createOperationDto.id_site && createOperationDto.id_site !== siteId) {
        throw new ConflictException(
          `You can only create operations in your site (${siteId})`,
        );
      }
      createOperationDto.id_site = siteId;
      if (!createOperationDto.id_subsite) {
        createOperationDto.id_subsite = subsiteId;
      }
    }

    if (isSupervisor) {
      if (
        createOperationDto.id_subsite &&
        createOperationDto.id_subsite !== subsiteId
      ) {
        throw new ConflictException(
          `You can only create operations in your subsite (${subsiteId})`,
        );
      }
      createOperationDto.id_subsite = subsiteId;
    }
    createOperationDto.id_user = userId;
    const response = await this.operationService.createWithWorkers(
      createOperationDto,
      !isSuperAdmin ? subsiteId : undefined,
      !isSuperAdmin ? siteId : undefined,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    } else if (response['status'] === 400) {
      throw new BadRequestException(response['message']);
    } else if (response['status'] === 403) {
      throw new ForbiddenException(response['message']);
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
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    const response = await this.operationService.findAll(
      !isSuperAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );

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
  @ApiOperation({
    summary: 'Get worker distribution by hour for a specific date',
  })
  async getWorkerDistributionByHour(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: WorkerDistributionQueryDto,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    if (!queryDto.date) {
      const today = getColombianDateTime();
      queryDto.date = today.toISOString().split('T')[0];
    }
    return this.workerAnalyticsService.getWorkerDistributionByHour(
      queryDto.date,
      isAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );
  }

  @Get('analytics/worker-hours')
  @ApiOperation({ summary: 'Get monthly report of hours worked per worker' })
  async getWorkerHoursReport(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: WorkerHoursReportQueryDto,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    console.log(isAdmin, isSupervisor, siteId, subsiteId);
    const month = queryDto.month || new Date().getMonth() + 1;
    const year = queryDto.year || new Date().getFullYear();
    return this.workerAnalyticsService.getWorkerHoursReport(month, year, isAdmin ? siteId : undefined, isSupervisor ? subsiteId : undefined);
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
    @CurrentUser('isSupervisor')
    isSupervisor: boolean,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('role') userRole: Role,
    activatePaginated: boolean,
  ) {
    try {
      // Construir el objeto de filtros
      const filters: OperationFilterDto = {};

      if (userRole === Role.ADMIN) {
        filters.id_site = siteId;
      }
      if (userRole === Role.SUPERVISOR) {
        filters.id_subsite = subsiteId;
      }
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
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
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

    const response = await this.operationService.findActiveOperations(
      statusesToUse,
      !isSuperAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );

    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }

    return response;
  }

  @Get('by-date')
  async findByDate(
    @Query('dateStart', DateTransformPipe) dateStart: Date,
    @Query('dateEnd', DateTransformPipe) dateEnd: Date,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    const response = await this.operationService.findOperationRangeDate(
      dateStart,
      dateEnd,
      isAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get('by-user')
  async findByWorker(
    @CurrentUser('userId') id: number,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    const response = await this.operationService.findOperationByUser(
      id,
      isAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('isAdmin') isAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('isGH') isGH: boolean,
  ) {
    if (isGH) {
      throw new BadRequestException(
        'You cannot access this endpoint as a GH user',
      );
    }
    const response = await this.operationService.findOne(
      id,
      isAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );
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
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('isAdmin') isAdmin: boolean,
  ) {
    if (!isSuperAdmin) {
      if (updateOperationDto.id_site && updateOperationDto.id_site !== siteId) {
        throw new ConflictException(
          `You can only update operations in your site (${siteId})`,
        );
      }
      updateOperationDto.id_site = siteId;
    }

    if (isSupervisor) {
      if (
        updateOperationDto.id_subsite &&
        updateOperationDto.id_subsite !== subsiteId
      ) {
        throw new ConflictException(
          `You can only update operations in your subsite (${subsiteId})`,
        );
      }
      updateOperationDto.id_subsite = subsiteId;
    }
    const response = await this.operationService.update(
      id,
      updateOperationDto,
      !isSuperAdmin ? subsiteId : undefined,
      !isSuperAdmin ? siteId : undefined,
    );
    if (response && response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }else if (response && response['status'] === 400) {
      throw new BadRequestException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('isSupervisor') isSupervisor: number,
    @CurrentUser('isAdmin') isAdmin: number,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    console.log
    const response = await this.operationService.remove(
      id,
      isAdmin ? siteId : undefined,
      isSupervisor ? subsiteId : undefined,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 400) {
      throw new BadRequestException(response['message']);
    }

    return response;
  }
}
