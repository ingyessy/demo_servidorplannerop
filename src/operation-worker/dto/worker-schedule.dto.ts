import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class WorkerScheduleDto {
  @ApiProperty({
    description:
      'ID único o array de IDs de trabajadores para esta programación',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  workerIds!: number[]; // Cambiamos de id único a un array de IDs

  @ApiProperty({ example: 'ezHU785s2' })
  @IsOptional()
  @IsString()
  id_group?: string;

  @ApiProperty({
    description: 'Fecha de inicio para estos trabajadores',
    example: '2023-10-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @ApiProperty({
    description: 'Fecha de fin para estos trabajadores',
    example: '2023-10-31T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @ApiProperty({
    description: 'Hora de inicio para estos trabajadores',
    example: '08:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeStart?: string;

  @ApiProperty({
    description: 'Hora de fin para estos trabajadores',
    example: '17:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeEnd?: string;

  @ApiProperty({
    description: 'ID de la tarea específica para este grupo de trabajadores',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  id_task?: number;

  @ApiProperty({
    description: 'ID de la subtask (subservicio) asignada al grupo',
    example: 163,
    required: true,
  })
  @IsNumber()
  id_subtask!: number;

  @ApiProperty({
    description: 'Id de la tarifa asociada a este grupo de trabajadores',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  id_tariff?: number;

  @ApiProperty({ example: 'Observation text', required: false })
  @IsString()
  @IsOptional()
  observation?: string;

  @ApiProperty({
    description: 'Cantidad para unidades no horarias (por ejemplo, CAJAS).',
    example: 99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  number_of_hours?: number;

  @ApiProperty({
    description:
      'Alias de cantidad usado por algunos clientes para unidades no horarias.',
    example: 99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  group_hours?: number;

  @ApiProperty({
    description: 'Cantidad explícita para facturación especial (ej. CAJAS).',
    example: 1234,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;
}
