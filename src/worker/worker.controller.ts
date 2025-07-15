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
/**
 * @category Controller
 */
@Controller('worker')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class WorkerController {
  constructor(private readonly workerService: WorkerService, private readonly excelExportService: ExcelExportService) {}

  @Post()
  @UsePipes(new DateTransformPipe())

  async create(@Body() createWorkerDto: CreateWorkerDto, @CurrentUser("userId") userId: number) {
    createWorkerDto.id_user = userId;
    const response = await this.workerService.create(createWorkerDto);
    if (response['status'] === 409) {
      throw new ConflictException(response["message"]);
    }
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }



  @Get()
  @ApiQuery({name: 'format', required: false, enum: ['json', 'excel', 'base64'], description: 'Formato de respuesta: json por defecto o excel para exportación'})
 async findAll(
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await  this.workerService.findAll();
  if(!Array.isArray(response)){
    return response;
  }
  if(format === 'excel') {
    return this.excelExportService.exportToExcel(res,response, 'Trabajadores', 'Trabajadores','binary');
  }

    return response;
  }

  @Get(':dni')
  async findDni(@Param('dni')dni:string){
    const response = await this.workerService.finDni(dni);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.workerService.findOne(id);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }

  @Patch(':id')
  @UsePipes(new DateTransformPipe())
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkerDto: UpdateWorkerDto,
  ) {
    const response = await this.workerService.update(id, updateWorkerDto);
    if (response["status"] === 404) {
      throw new NotFoundException(response["message"]);
    }
    return response;
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.workerService.remove(id);
  }
}
