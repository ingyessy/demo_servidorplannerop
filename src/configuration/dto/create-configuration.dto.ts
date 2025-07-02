import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation, TypeValueConfiguration } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateConfigurationDto {
  @ApiProperty({ example: 'Configuration Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'This is a configuration description' })
  @IsString()
  description: string;

  @ApiProperty({
    example: `${Object.values(TypeValueConfiguration).join(', ')}`,
  })
  @IsEnum(TypeValueConfiguration, {
    message: `typeValue debe ser uno de los siguientes valores: ${Object.values(TypeValueConfiguration).join(', ')}`,
  })
  typeValue: TypeValueConfiguration;

  @ApiProperty({ example: 'Configuration Value' })
  @IsString()
  value: string;

  @ApiProperty({
    example: `${Object.values(StatusActivation).join(', ')}`,
  })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  status: StatusActivation;

  @ApiHideProperty()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_user: number;
}
