import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedingStatus } from '@prisma/client';

export class FilterWorkerFeedingDto {
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
    description: 'Tipo de alimentación',
    required: false,
    enum: FeedingStatus,
  })
  @IsOptional()
  @IsEnum(FeedingStatus)
  type?: FeedingStatus;

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

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id_site?: number;
}
