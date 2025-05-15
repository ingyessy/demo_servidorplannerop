import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Failures } from '@prisma/client';

export class FilterCalledAttentionDto {
  @ApiProperty({
    description: 'Fecha de inicio para filtrar',
    required: false,
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiProperty({
    description: 'Fecha de fin para filtrar',
    required: false,
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiProperty({
    description: 'Tipo de llamado de atención',
    required: false,
    enum: Failures,
  })
  @IsOptional()
  @IsEnum(Failures)
  type?: Failures;

  @ApiProperty({
    description: 'Texto para búsqueda por DNI o nombre del trabajador',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description:
      'Desactivar paginación (true para obtener todos los registros)',
    required: false,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activatePaginated?: boolean;
}
