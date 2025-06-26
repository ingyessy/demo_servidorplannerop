import { ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class CreateSubtaskDto {
  @ApiProperty({ example: 'Subtask Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: `${Object.values(StatusActivation).join('|')}` })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(
      StatusActivation,
    ).join(', ')}`,
  })
  status: StatusActivation;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_task: number;

  @ApiProperty({ example: '007' })
  @IsString()
  code: string;
}
