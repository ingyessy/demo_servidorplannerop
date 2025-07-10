import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { AdditionalHours } from '../entities/worker-group-analysis.types';

export class CreateBillDto {
  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_operation: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  amount: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  number_of_workers: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_bill: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_paysheet: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  week_number: number;

  @ApiProperty({ example: '2.34' })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  number_of_hours: number;

  @ApiProperty({
    description: 'Horas adicionales por grupo',
    example: {
    'grupo-123': {
        // Horas para nómina
        'OD': 1,     // Ordinaria Diurna
        'ON': 0,     // Ordinaria Nocturna
        'ED': 2,     // Extra Diurna
        'EN': 0,     // Extra Nocturna
        'FOD': 0,    // Festiva Ordinaria Diurna
        'FON': 0,    // Festiva Ordinaria Nocturna
        'FED': 0,    // Festiva Extra Diurna
        'FEN': 0,    // Festiva Extra Nocturna
        
        // Horas para facturación (con prefijo FAC_)
        'FAC_OD': 1,   // Facturación Ordinaria Diurna
        'FAC_ED': 2,   // Facturación Extra Diurna
        
        // También se aceptan horas con prefijo H para compatibilidad
        'HED': 2      // Equivalente a ED
      },
      'grupo-456': {
        'FOD': 1,      // Festiva Ordinaria Diurna para nómina
        'FAC_FOD': 1   // Festiva Ordinaria Diurna para facturación
      }
    },
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  additionalHours?: Record<string, AdditionalHours>;

  @ApiHideProperty()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_user: number;
}
