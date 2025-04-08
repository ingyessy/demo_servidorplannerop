import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { CreateOperationDto } from './create-operation.dto';
import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkerScheduleDto } from 'src/operation-worker/dto/worker-schedule.dto';

// Omitimos los campos de relación del DTO base
class OperationUpdateBaseDto extends OmitType(CreateOperationDto, [
  'id_user',
  'id_area',
  'id_task', 
  'id_client',
  'workerIds',
  'inChargedIds',
  'groups'
] as const) {}

// Tipo para conectar trabajadores simples (por ID)
export class SimpleWorkerConnect {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;
}

// DTO específico para la conexión de trabajadores programados
export class ScheduledWorkerConnect extends WorkerScheduleDto {}

// Hacemos los campos restantes opcionales
export class UpdateOperationDto extends PartialType(OperationUpdateBaseDto) {
  // Si aún necesitas actualizar workers, usa un formato que Prisma pueda entender
  @ApiProperty({
    type: Object,
    required: false,
    example: {
      connect: [
        { id: 1 },
        { id: 2 },
        {
          workerIds: [3, 4],
          dateStart: "2023-10-01",
          dateEnd: "2023-10-31",
          timeStart: "08:00",
          timeEnd: "17:00"
        }
      ],
      update: [
        {
          workerIds: [3, 4],
          dateStart: "2023-11-01",
          dateEnd: "2023-11-15",
          timeStart: "09:00",
          timeEnd: "18:00"
        }
      ],
      disconnect: [{ id: 5 }]
    }
  })
  @IsOptional()
  workers?: {
    connect?: Array<SimpleWorkerConnect | ScheduledWorkerConnect>;
    update?: WorkerScheduleDto[]; // Nueva propiedad
    disconnect?: Array<{ id: number }>;
  };
  // Si aún necesitas actualizar inCharged, usa un formato que Prisma pueda entender
  @ApiProperty({ 
    type: Object, 
    required: false,
    example: { 
      connect: [{ id: 1 }, { id: 2 }],
      disconnect: [{ id: 3 }]
    } 
  })
  @IsOptional()
  inCharged?: {
    connect?: Array<{ id: number }>;
    disconnect?: Array<{ id: number }>;
  };
}