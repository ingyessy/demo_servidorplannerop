import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';

export class FinalizeGroupDto {
  @ApiProperty({
    example: 1792,
    description: 'ID de la operacion',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_operation: number;

  @ApiProperty({
    example: '83f2e536-f56c-4af4-8cf6-28b880b89309',
    description: 'ID del grupo (id_group) a finalizar',
  })
  @IsString()
  id_group: string;

  @ApiProperty({
    example: '2026-03-27',
    description: 'Fecha de finalizacion del grupo (YYYY-MM-DD)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateEnd debe tener formato YYYY-MM-DD',
  })
  dateEnd: string;

  @ApiProperty({
    example: '17:30',
    description: 'Hora de finalizacion del grupo (HH:MM)',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/, {
    message: 'timeEnd debe tener formato HH:MM',
  })
  timeEnd: string;
}