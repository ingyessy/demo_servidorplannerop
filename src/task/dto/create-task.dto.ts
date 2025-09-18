import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Task 1' })
  @IsString()
  name: string;

  @ApiHideProperty()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  id_user?: number;

  @ApiProperty({ example: '1' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  id_site?: number;

  @ApiProperty({ example: '1' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  id_subsite?: number | null;
}
