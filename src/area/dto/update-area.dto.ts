import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateAreaDto } from './create-area.dto';
import { IsEnum } from 'class-validator';
import { StatusActivation } from '@prisma/client';


export class UpdateAreaDto extends PartialType(CreateAreaDto) {
    
  @ApiProperty({ example: 'ACTIVATE' })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  status: StatusActivation;
}
