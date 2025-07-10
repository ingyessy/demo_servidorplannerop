import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusActivation } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCostCenterDto {
  @ApiProperty({ example: '0014' })
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

  @ApiProperty({example: `${Object.values(StatusActivation).join(', ')}`})
  @IsEnum(StatusActivation,{
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusActivation).join(', ')}`,
  })
  status: StatusActivation
}
