import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
    description: 'ID del subsitio al cual cambiar (null para limpiar la subsede)',
    example: 3,
    type: Number,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.id_subsite !== null && o.id_subsite !== undefined)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => {
    // Preservar null explícitamente
    if (value === null || value === 'null') return null;
    // Convertir string a number si es válido
    if (typeof value === 'string' && !isNaN(+value)) return +value;
    return value;
  })
  id_subsite?: number | null;
}