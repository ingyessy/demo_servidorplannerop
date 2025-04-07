import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class AssignWorkersDto {
  @ApiProperty({
    description: 'ID de la operación a la que se asignarán trabajadores',
    example: 1
  })
  @IsNumber()
  id_operation: number;

  @ApiProperty({
    description: 'IDs de los trabajadores a asignar',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  workerIds: number[];

  @ApiProperty({example: '2023-10-01'})
  @IsOptional()
  @IsString()
  dateStart?: string;

  @ApiProperty({example: '2023-10-31'})
  @IsOptional()
  @IsString()
  dateEnd?: string;

  @ApiProperty({example: '01:00'})
  @IsOptional()
  @IsString()
  timeStart?: string;
  
  @ApiProperty({example: '01:54'})
  @IsOptional()
  @IsString()
  timeEnd?: string;
}