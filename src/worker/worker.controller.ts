import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ConflictException,
  NotFoundException,
  UseGuards,
  UsePipes,
  Res,
  Query,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { Response } from 'express';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
/**
 * @category Controller
 */
@Controller('worker')
@UseGuards(JwtAuthGuard)
@UseInterceptors(SiteInterceptor)
@ApiBearerAuth('access-token')
export class WorkerController {
  constructor(
    private readonly workerService: WorkerService,
    private readonly excelExportService: ExcelExportService,
  ) {}

 @Post()
async create(
  @Body() createWorkerDto: CreateWorkerDto,
  @CurrentUser('userId') userId: number,
  @CurrentUser('siteId') siteId: number,
  @CurrentUser('subsiteId') subsiteId: number,
) {
    // Agrega el log aquí
  console.log('subsiteId recibido:', subsiteId);
  createWorkerDto.id_user = userId;

  if (typeof createWorkerDto.id_site === 'undefined' || createWorkerDto.id_site === null) {
    createWorkerDto.id_site = siteId;
  }
  if (typeof createWorkerDto.id_subsite === 'undefined' || createWorkerDto.id_subsite === null) {
    createWorkerDto.id_subsite = subsiteId;
  }

  return await this.workerService.create(createWorkerDto, siteId);
}
  @Get()
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'excel', 'base64'],
    description:
      'Formato de respuesta: json por defecto o excel para exportación',
  })
  @Get()
  @ApiOperation({ summary: 'Obtener todos los trabajadores' })
  @ApiQuery({
    name: 'globalSearch',
    required: false,
    type: Boolean,
    description:
      'Si es true, obtiene todos los trabajadores sin filtrar por sede (para mostrar nombres)',
  })
  async findAll(
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
    @Query('globalSearch') globalSearch?: boolean,
  ) {
    return this.workerService.findAll(
      globalSearch ? undefined : siteId,
      globalSearch ? undefined : subsiteId,
      // globalSearch || false
    );
  }

  //   @Get()
  // async findAll(
  //   @CurrentUser('siteId') siteId: number,
  //   @CurrentUser('subsiteId') subsiteId?: number | null, // Agregar este parámetro
  // ) {
  //   const response = await this.workerService.findAll(siteId, subsiteId);
  //   return response;
  // }
  // async findAll(
  //   @Query('format') format: string = 'json',
  //   @Res({ passthrough: true }) res: Response,
  //   @CurrentUser('siteId') siteId: number,
  // ) {
  //   const response = await this.workerService.findAll(siteId);
  //   if (!Array.isArray(response)) {
  //     return response;
  //   }
  //   if (format === 'excel') {
  //     return this.excelExportService.exportToExcel(
  //       res,
  //       response,
  //       'Trabajadores',
  //       'Trabajadores',
  //       'binary',
  //     );
  //   }

  //   return response;
  // }

  @Get(':dni')
  async findDni(
    @Param('dni') dni: string,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.workerService.finDni(dni, siteId);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get('by-id/:id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.workerService.findOne(id, siteId);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  @UsePipes(new DateTransformPipe())
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkerDto: UpdateWorkerDto,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
  ) {
    const validateId = await this.workerService.findOne(id, siteId);
    if (validateId['id_site'] !== siteId) {
      throw new ForbiddenException(
        `You can only update workers in your site (${siteId})`,
      );
    }

    if (isSupervisor && validateId['id_subsite'] !== subsiteId) {
      throw new ForbiddenException(
        `You can only update workers in your subsite (${subsiteId})`,
      );
    }
    if (validateId['status'] === 404) {
      throw new NotFoundException(validateId['message']);
    }
    const response = await this.workerService.update(
      id,
      updateWorkerDto,
      siteId,
    );

    // if (response['status'] === 409) {
    //   throw new ConflictException(response['message']);
    // }

    return response;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') siteId: number,
  ) {
    const validateId = await this.workerService.findOne(id, siteId);
    if (validateId['status'] === 404) {
      throw new ConflictException('Unathorized to delete this worker');
    }
    const response = await this.workerService.remove(id);
    return response;
  }
}
