import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class RemoveWorkersDto {
  @ApiProperty({
    description: 'ID de la operación de la que se removerán trabajadores',
    example: 1
  })
  @IsNumber()
  id_operation: number;

  @ApiProperty({
    description: 'IDs de los trabajadores a remover',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  workerIds: number[];
}