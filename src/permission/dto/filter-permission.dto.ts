import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  Matches,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';


export class FilterPermissionDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_worker?: number;

  @ApiProperty({ required: false, example: '2021-09-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateDisableStart debe tener formato YYYY-MM-DD',
  })
  dateDisableStart?: string;

  @ApiProperty({ required: false, example: '2025-05-07' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateDisableStart debe tener formato YYYY-MM-DD',
  })
  dateDisableEnd?: string;


  @IsNumber()
  @IsOptional()
  id_site?: number;
}