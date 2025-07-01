import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkerScheduleDto } from './worker-schedule.dto';

export class AssignWorkersDto {
  @ApiProperty({
    description: 'ID de la operación a la que se asignarán trabajadores',
    example: 1
  })
  @IsNumber()
  id_operation: number;

  @ApiProperty({
    description: 'IDs de los trabajadores a asignar (sin programación)',
    example: [1, 2, 3],
    type: [Number],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  workerIds?: number[];

  @ApiProperty({
    description: 'Grupos de trabajadores con programación compartida',
    type: [WorkerScheduleDto],
    required: false,
    example: [
      {
        workerIds: [1, 2],
        dateStart: "2023-10-01", 
        dateEnd: "2023-10-15",
        timeStart: "08:00",
        timeEnd: "12:00",
        id_task: 1,
        id_tariff: 1
      },
      {
        workerIds: [3, 4],
        dateStart: "2023-10-01",
        dateEnd: "2023-10-15",
        timeStart: "13:00",
        timeEnd: "17:00",
        id_task: 2,
        id_tariff: 2
      }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerScheduleDto)
  workersWithSchedule?: WorkerScheduleDto[];
}