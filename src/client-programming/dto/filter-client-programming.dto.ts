import { ApiProperty } from '@nestjs/swagger';
import { StatusComplete } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';

export class FilterClientProgrammingDto {
  @ApiProperty({
    example: '2025-01-01',
    description: 'Fecha de inicio mínima (formato: YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateStart?: Date;

  @ApiProperty({
    description: 'Estado(s) de las operaciones',
    required: false,
    enum: StatusComplete,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si es un array, devolver el array
    if (Array.isArray(value)) {
      return value;
    }
    // Si es un string, transformarlo a un array
    if (typeof value === 'string') {
      // Si contiene comas, dividirlo
      if (value.includes(',')) {
        return value.split(',');
      }
      // Si es un solo valor, convertirlo a array
      return [value];
    }
    // Valor por defecto
    return [];
  })
  @IsEnum(StatusComplete, { each: true })
  status?: StatusComplete[];

  @ApiProperty({
    description: 'Texto para búsqueda en servicio, cliente o ubicación',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
