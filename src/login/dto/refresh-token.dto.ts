import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'ID del sitio al cual cambiar',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  id_site?: number;

  @ApiPropertyOptional({
    description: 'ID del subsitio al cual cambiar',
    example: 3,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  id_subsite?: number;
}