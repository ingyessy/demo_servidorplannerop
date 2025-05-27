import { ApiProperty } from '@nestjs/swagger';
import { StatusComplete } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @IsEnum(StatusComplete, { each: true })
  status?: StatusComplete[];
}
