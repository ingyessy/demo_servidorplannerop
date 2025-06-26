import { PartialType } from '@nestjs/swagger';
import { CreateSubsiteDto } from './create-subsite.dto';

export class UpdateSubsiteDto extends PartialType(CreateSubsiteDto) {}
