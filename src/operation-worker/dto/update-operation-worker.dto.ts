import { PartialType } from '@nestjs/swagger';
import { CreateOperationWorkerDto } from './create-operation-worker.dto';

export class UpdateOperationWorkerDto extends PartialType(CreateOperationWorkerDto) {}
