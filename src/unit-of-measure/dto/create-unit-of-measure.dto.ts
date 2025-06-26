import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUnitOfMeasureDto {
  @ApiProperty({ example: 'Name unit of measure' })
  @IsString()
  name: string;

  @ApiHideProperty()
  @IsNumber()
  @IsOptional()
  id_user: number;

  @ApiProperty({ example: `${Object.keys(StatusActivation).join(', ')}` })
  @IsEnum(StatusActivation, {
    message: `Status must be one of the following: ${Object.keys(StatusActivation).join(', ')}`,
  })
  status: StatusActivation;
}
