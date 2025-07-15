import { PartialType } from '@nestjs/swagger';
import { CreateCalledAttentionDto } from './create-called-attention.dto';

export class UpdateCalledAttentionDto extends PartialType(CreateCalledAttentionDto) {}
