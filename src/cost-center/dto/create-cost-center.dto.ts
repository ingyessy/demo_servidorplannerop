import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCostCenterDto {
  @ApiProperty({ example: 'Cost Center Code' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Cost Center Name' })
  @IsString()
  name: string;

  @ApiHideProperty()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_site?: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_subsite: number;

  @ApiHideProperty()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  id_user?: number;

  @ApiProperty({ example: '1' })
  @IsNumber()
  @Type(() => Number)
  id_client: number;
}
