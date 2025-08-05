import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBillDto, HoursDistribution, WorkerPay } from './create-bill.dto';
import { IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';


export class UpdateBillDto {
  @ApiProperty({ example: '1' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Distribuccion horaria para facturacion' })
  billHoursDistribution: HoursDistribution;

  @ApiProperty({ description: 'Distribuccion horaria para nomina' })
  paysheetHoursDistribution: HoursDistribution;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  amount: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  group_hours: number;


  @ApiProperty({ example: 'Observation text' })
  @IsString()
  @IsOptional()
  @Type(() => String)
  observation?: string;


  @IsOptional()
  @ValidateNested({ each: true })
  pays: WorkerPay[];
}
