import { ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class CreateSubsiteDto {
  @ApiProperty({ example: 'Subsite Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: `${Object.values(StatusActivation).join('|')}` })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  @Transform(({ value }) => value.toUpperCase())
  status: StatusActivation;

  @ApiProperty({ example: '12' })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  id_site: number;
}
