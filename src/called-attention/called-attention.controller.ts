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
  BadRequestException,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CalledAttentionService } from './called-attention.service';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';

@Controller('called-attention')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CalledAttentionController {
  constructor(
    private readonly calledAttentionService: CalledAttentionService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  @Post()
  async create(
    @Body() createCalledAttentionDto: CreateCalledAttentionDto,
    @CurrentUser('userId') userId: number,
  ) {
    createCalledAttentionDto.id_user = userId;
    const response = await this.calledAttentionService.create(
      createCalledAttentionDto,
    );
    if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    } else if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 400) {
      throw new BadRequestException(response['message']);
    }
    return response;
  }

  @Get('paginated')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página para paginación',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número de registros por página',
  })
  async findPaginated(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const response = await this.calledAttentionService.findAllPaginated(
      page,
      limit,
    );
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
  ) {
    const response = await this.calledAttentionService.findAll();

    // Si no hay datos o hay un error, devolver la respuesta original
    if (!Array.isArray(response)) {
      return response;
    }

    if (format === 'excel') {
      // Para Excel necesitamos control total de la respuesta (passthrough: false)
      return this.excelExportService.exportToExcel(
        res,
        response,
        'llamados_atencion',
        'Llamados de Atención',
        'binary',
      );
    }
    
    if (format === 'base64') {
      // Generar Excel en Base64
      return this.excelExportService.exportToExcel(
        null,
        response,
        'llamados_atencion',
        'Llamados de Atención',
        'base64',
      );
    }
    
    // Formato JSON por defecto (con passthrough: true)
    return response;
  }
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.calledAttentionService.findOne(id);
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCalledAttentionDto: UpdateCalledAttentionDto,
    @CurrentUser('userId') userId: number,
  ) {
    updateCalledAttentionDto.id_user = userId;
    const response = await this.calledAttentionService.update(
      id,
      updateCalledAttentionDto,
    );
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.calledAttentionService.remove(id);
    return response;
  }
}
