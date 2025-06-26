import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  name: string;

  @ApiHideProperty()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  id_user?: number;

  @ApiProperty({ example: `${Object.values(StatusActivation).join(', ')}` })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  status: StatusActivation;
}
