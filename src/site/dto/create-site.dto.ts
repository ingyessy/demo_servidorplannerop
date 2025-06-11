import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'My Site' })
  @IsString()
  name: string;

  @ApiProperty({ example: `${Object.values(StatusActivation).join(', ')}` })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  @Transform(({ value }) => value.toUpperCase())
  @IsOptional()
  status?: StatusActivation;

  @ApiHideProperty()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  id_user?: number;
}
