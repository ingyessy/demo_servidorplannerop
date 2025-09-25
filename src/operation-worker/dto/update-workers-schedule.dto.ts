import { ApiProperty } from '@nestjs/swagger';
import { WorkerScheduleDto } from './worker-schedule.dto';

export class UpdateWorkersScheduleDto {
  @ApiProperty()
  id_operation: number;

  @ApiProperty({ type: [WorkerScheduleDto] })
  workersToUpdate: WorkerScheduleDto[];

}