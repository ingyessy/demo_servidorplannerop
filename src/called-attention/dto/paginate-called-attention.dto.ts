import { ApiProperty } from '@nestjs/swagger';
import { Failures } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class PaginatedCalledAttentionQueryDto {
  @ApiProperty({
    description: 'Número de página para paginación',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiProperty({
    description: 'Elementos por página (máximo: 50)',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiProperty({
    description: 'Tipo de llamado de atención',
    required: false,
    enum: Failures,
  })
  @IsOptional()
  @IsEnum(Failures)
  type?: Failures;

  @ApiProperty({
    description: 'Fecha de inicio para filtrar (formato: YYYY-MM-DD)',
    required: false,
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiProperty({
    description: 'Fecha de fin para filtrar (formato: YYYY-MM-DD)',
    required: false,
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiProperty({
    description: 'Texto para buscar por DNI o nombre del trabajador',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Desactivar paginación (false para obtener todos los registros)',
    required: false,
    default: true,
    type: Boolean,
  })
  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => {
    if (value === 'false' || value === '0') return false;
    if (value === 'true' || value === '1') return true;
    return value;
  })
  @IsBoolean()
  activatePaginated?: boolean = true;
}