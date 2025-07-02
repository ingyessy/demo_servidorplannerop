import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation, YES_NO } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTariffDto {
  @ApiHideProperty()
  @IsString()
  @IsOptional()
  code: string;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_subtask: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_costCenter: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_unidOfMeasure: number;

  @ApiProperty({ example: '100.00' })
  @IsNumber()
  @Type(() => Number)
  paysheet_tariff: number;

  @ApiProperty({ example: '150.00' })
  @IsNumber()
  @Type(() => Number)
  facturation_tariff: number;

  @ApiProperty({ example: `${Object.values(YES_NO).join(', ')}` })
  @IsEnum(YES_NO, {
    message: `full_tariff debe ser uno de los siguientes valores: ${Object.values(YES_NO).join(', ')}`,
  })
  full_tariff: YES_NO;

  @ApiProperty({ example: `${Object.values(YES_NO).join(', ')}` })
  @IsEnum(YES_NO, {
    message: `compensatory debe ser uno de los siguientes valores: ${Object.values(YES_NO).join(', ')}`,
  })
  compensatory: YES_NO;

  @ApiProperty({ example: `${Object.values(YES_NO).join(', ')}` })
  @IsEnum(YES_NO, {
    message: `hourly_paid_service debe ser uno de los siguientes valores: ${Object.values(YES_NO).join(', ')}`,
  })
  hourly_paid_service: YES_NO;

  @ApiProperty({ example: '1.00' })
  @IsNumber()
  @Type(() => Number)
  OD: number;

  @ApiProperty({ example: '1.35' })
  @IsNumber()
  @Type(() => Number)
  ON: number;

  @ApiProperty({ example: '1.50' })
  @IsNumber()
  @Type(() => Number)
  ED: number;

  @ApiProperty({ example: '1.75' })
  @IsNumber()
  @Type(() => Number)
  EN: number;

  @ApiProperty({ example: '1.75' })
  @IsNumber()
  @Type(() => Number)
  FOD: number;

  @ApiProperty({ example: '2.10' })
  @IsNumber()
  @Type(() => Number)
  FON: number;

  @ApiProperty({ example: '2.00' })
  @IsNumber()
  @Type(() => Number)
  FED: number;

  @ApiProperty({ example: '2.50' })
  @IsNumber()
  @Type(() => Number)
  FEN: number;

  @ApiHideProperty()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_user: number;

  @ApiProperty({ example: `${Object.values(StatusActivation).join(', ')} ` })
  @IsEnum(StatusActivation, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  status: StatusActivation;
}
