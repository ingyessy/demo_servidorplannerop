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
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { OperationService } from './operation.service';
import { Response } from 'express';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { StatusOperation } from '@prisma/client';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { OperationFilterDto } from './dto/fliter-operation.dto';

@Controller('operation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OperationController {
  constructor(private readonly operationService: OperationService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  @Post()
  @UsePipes(new DateTransformPipe())
  async create(@Body() createOperationDto: CreateOperationDto, @CurrentUser("userId") userId: number) {
    createOperationDto.id_user = userId;
    console.log(createOperationDto);
        const response = await this.operationService.createWithWorkers(createOperationDto);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
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
    @Res({passthrough: true}) res: Response,
  ) {
    const response = await this.operationService.findAll();

    if (!Array.isArray(response)) {
      return response;
    }
    if(format === 'excel') {
      return this.excelExportService.exportToExcel(res, response, 'operations','Operaciones', 'binary');
    }
    if(format === 'base64') {
      return this.excelExportService.exportToExcel(res, response, 'operations','Operaciones', 'base64');
    }
    return response;
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Obtener operaciones con paginación y filtros opcionales' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página para paginación (por defecto: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página (por defecto: 10, máximo: 50)' })
  @ApiQuery({ name: 'status', required: false, isArray: true, enum: StatusOperation, description: 'Estado(s) de las operaciones' })
  @ApiQuery({ name: 'dateStart', required: false, type: Date, description: 'Fecha de inicio mínima' })
  @ApiQuery({ name: 'dateEnd', required: false, type: Date, description: 'Fecha de fin máxima' })
  @ApiQuery({ name: 'jobAreaId', required: false, type: Number, description: 'ID del área de trabajo' })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'ID del usuario asociado' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Texto para búsqueda en descripción, tarea o área' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista paginada de operaciones con prefetch de páginas adicionales'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'No se encontraron operaciones para los criterios solicitados'
  })
  async findAllPaginated(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: StatusOperation[],
    @Query('dateStart') dateStartStr?: string,
    @Query('dateEnd') dateEndStr?: string,
    @Query('jobAreaId', new DefaultValuePipe(0), ParseIntPipe) jobAreaId?: number,
    @Query('userId', new DefaultValuePipe(0), ParseIntPipe) userId?: number,
    @Query('search') search?: string,
  ) {
    try {
      // Procesar fechas si están presentes
      let dateStart: Date | undefined;
      let dateEnd: Date | undefined;
      
      if (dateStartStr) {
        dateStart = new Date(dateStartStr);
        if (isNaN(dateStart.getTime())) {
          throw new BadRequestException('Invalid dateStart format');
        }
      }
      
      if (dateEndStr) {
        dateEnd = new Date(dateEndStr);
        if (isNaN(dateEnd.getTime())) {
          throw new BadRequestException('Invalid dateEnd format');
        }
      }
      
      // Construir el objeto de filtros
      const filters: OperationFilterDto = {};
      
      if (status && status.length > 0) filters.status = status;
      if (dateStart) filters.dateStart = dateStart;
      if (dateEnd) filters.dateEnd = dateEnd;
      if (jobAreaId && jobAreaId > 0) filters.jobAreaId = jobAreaId;
      if (userId && userId > 0) filters.userId = userId;
      if (search && search.trim() !== '') filters.search = search.trim();
      
      // Llamar al servicio con los filtros
      return await this.operationService.findAllPaginated(page, limit, filters);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Error processing paginated request: ${error.message}`);
    }
  }

   @Get('by-status')
  async findByStatus(@Query('status') statusParam: StatusOperation | StatusOperation[]) {
    // Si no se proporciona un parámetro, usar los estados por defecto
    const statuses = statusParam 
      ? (Array.isArray(statusParam) ? statusParam : [statusParam]) 
      : [StatusOperation.INPROGRESS, StatusOperation.PENDING];
    
    // Validar que todos los estados sean del enum StatusOperation
    const validStatuses = Object.values(StatusOperation);
    const filteredStatuses = statuses.filter(status => 
      validStatuses.includes(status as StatusOperation)
    ) as StatusOperation[];
    
    // Si después de filtrar no quedan estados válidos, usar los por defecto
    const statusesToUse = filteredStatuses.length > 0 
      ? filteredStatuses 
      : [StatusOperation.INPROGRESS, StatusOperation.PENDING];
    
    const response = await this.operationService.findActiveOperations(statusesToUse);
    
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    
    return response;
  }

  @Get('by-date')
  async findByDate(
    @Query('dateStart', DateTransformPipe) dateStart: Date, 
    @Query('dateEnd', DateTransformPipe) dateEnd: Date
  ) {
    const response = await this.operationService.findOperationRangeDate(dateStart, dateEnd);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }

  @Get('by-user')
  async findByWorker(@CurrentUser("userId") id: number) {
    const response = await this.operationService.findOperationByUser(id);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.operationService.findOne(id);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
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
    if (response && response["status"] === 404) {
      throw new NotFoundException(response["messsge"]);
    }
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.operationService.remove(id);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }
}
