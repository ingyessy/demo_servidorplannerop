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
} from '@nestjs/common';
import { InabilityService } from './inability.service';
import { CreateInabilityDto } from './dto/create-inability.dto';
import { UpdateInabilityDto } from './dto/update-inability.dto';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FilterInabilityDto } from './dto/filter-inability';
import { Response } from 'express';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('inability')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class InabilityController {
  constructor(
    private readonly inabilityService: InabilityService,
    private readonly excelExportService: ExcelExportService,
  ) {}

  @Post()
  @UsePipes(DateTransformPipe)
  async create(@Body() createInabilityDto: CreateInabilityDto, @CurrentUser('userId') userId: number) {
    createInabilityDto.id_user = userId;
    const response = await this.inabilityService.create(createInabilityDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll() {
    const response = await this.inabilityService.findAll();
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.inabilityService.findOne(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
  @Get('search/filters')
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'excel', 'base64'],
    description:
      'Formato de respuesta: json por defecto o excel para exportación',
  })
  async findByFilters(
    @Query(DateTransformPipe) filters: FilterInabilityDto,
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.inabilityService.findByFilters(filters);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    if (!Array.isArray(response)) {
      return response;
    }
    if (format === 'excel') {
      return this.excelExportService.exportToExcel(
        res,
        response,
        'incapacidades',
        'Reporte de Incapacidades',
        'binary',
      );
    }

    if (format === 'base64') {
      return this.excelExportService.exportToExcel(
        null,
        response,
        'incapacidades',
        'Reporte de Incapacidades',
        'base64',
      );
    }
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateInabilityDto: UpdateInabilityDto,
  ) {
    const response = await this.inabilityService.update(
      +id,
      updateInabilityDto,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.inabilityService.remove(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
}
