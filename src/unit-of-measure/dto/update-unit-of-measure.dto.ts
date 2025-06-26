import { PartialType } from '@nestjs/swagger';
import { CreateUnitOfMeasureDto } from './create-unit-of-measure.dto';

export class UpdateUnitOfMeasureDto extends PartialType(CreateUnitOfMeasureDto) {}
