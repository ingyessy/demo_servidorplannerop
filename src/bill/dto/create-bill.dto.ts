import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AdditionalHours } from '../entities/worker-group-analysis.types';
import { Decimal } from '@prisma/client/runtime/library';

export class HoursDistribution {
  @ApiProperty({ example: '1' })
  @IsNumber()
  HOD!: number;
  HOD!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HON!: number;
  HON!: number;
  @IsNumber()
  @ApiProperty({ example: '2' })
  HED!: number;
  HED!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HEN!: number;
  HEN!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HFOD!: number;
  HFOD!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HFON!: number;
  HFON!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HFED!: number;
  HFED!: number;
  @IsNumber()
  @ApiProperty({ example: '0' })
  HFEN!: number;
  HFEN!: number;
}

export class GroupBillDto {
  @ApiProperty({ 
    example: '1',
    description: 'ID del grupo (opcional en actualizaciones)',
    required: false 
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Distribuccion horaria para facturacion' })
  billHoursDistribution!: HoursDistribution;
  billHoursDistribution!: HoursDistribution;

  @ApiProperty({ description: 'Distribuccion horaria para nomina' })
  paysheetHoursDistribution!: HoursDistribution;
  paysheetHoursDistribution!: HoursDistribution;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  amount?: number;

  @ApiProperty({ 
    example: 1,
    description: 'Duración total en horas del grupo (opcional). Este valor se calcula automáticamente desde las fechas de Operation_Worker. Solo se usa al crear la factura inicialmente.',
    required: false
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  group_hours?: Decimal;

  @ApiProperty({ 
    example: 1,
    description: 'Número de horas del grupo (usado para unidades por cantidad). Si no se proporciona, se usa group_hours.',
    required: false
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  number_of_hours?: number;


  @ApiProperty({ example: 'Observation text' })
  @IsString()
  @IsOptional()
  @Type(() => String)
  observation?: string;


  @IsOptional()
  @ValidateNested({ each: true })
  pays?: WorkerPay[];
// cuando la operacion es especial, la bill se crean con status
   @IsOptional()
  @IsObject()
  compensatory?: {
    hours: number;
    amount: number;
    percentage: number;
  };
}

export class WorkerPay {
  @ApiProperty({ example: '1' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  id_worker!: number;
  id_worker!: number;

  @ApiProperty({ example: '1.5' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pay!: number;
}

export class CreateBillDto {
  @ApiProperty({ example: '1', description: 'ID de la operación a facturar' })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  id_operation!: number;

  @ApiProperty({ 
    description: 'Grupos de trabajadores con sus distribuciones horarias y pagos',
    type: [GroupBillDto]
  })
  @ValidateNested({ each: true })
  @Type(() => GroupBillDto)
  groups!: GroupBillDto[];
}
