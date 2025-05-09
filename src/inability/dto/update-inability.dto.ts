import { PartialType } from '@nestjs/swagger';
import { CreateInabilityDto } from './create-inability.dto';

export class UpdateInabilityDto extends PartialType(CreateInabilityDto) {}
