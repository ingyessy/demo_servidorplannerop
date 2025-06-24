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
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @UsePipes(new DateTransformPipe())
  async create(
    @Body() createWorkerDto: CreateWorkerDto,
    @CurrentUser('userId') userId: number,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
  ) {
    createWorkerDto.id_user = userId;
    if (!createWorkerDto.id_site || !createWorkerDto.id_subsite) {
      createWorkerDto.id_site = siteId;
      createWorkerDto.id_subsite = subsiteId;
    }
    
    const response = await this.workerService.create(createWorkerDto, siteId);
    if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
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
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.workerService.findAll(siteId);
    if (!Array.isArray(response)) {
      return response;
    }
    if (format === 'excel') {
      return this.excelExportService.exportToExcel(
        res,
        response,
        'Trabajadores',
        'Trabajadores',
        'binary',
      );
    }

    return response;
  }

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
    if (validateId['id_site'] !== updateWorkerDto.id_site) {
      throw new ForbiddenException(
        `You can only update workers in your site (${siteId})`,
      );
    }

    if(isSupervisor && validateId['id_subsite'] !== updateWorkerDto.id_subsite) {
      throw new ForbiddenException(
        `You can only update workers in your subsite (${subsiteId})`,
      );
    }
    if (validateId['status'] === 404) {
      throw new NotFoundException(validateId['message']);
    }
    const response = await this.workerService.update(id, updateWorkerDto, siteId);

    if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }

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
