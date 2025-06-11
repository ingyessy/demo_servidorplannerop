import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class WorkerHoursReportQueryDto {
  @ApiPropertyOptional({
    description: 'Month (1-12). Default is current month.',
    example: 12,
    minimum: 1,
    maximum: 12,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @Transform(({ value }) => value || new Date().getMonth() + 1)
  month?: number;

  @ApiPropertyOptional({
    description: 'Year. Default is current year.',
    example: 2023,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2030)
  @Transform(({ value }) => value || new Date().getFullYear())
  year?: number;
}