import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';

export class RemoveInChargeDto {
  @ApiProperty({
    description: 'ID de la operación de la que se removerán encargados',
    example: 1
  })
  @IsNumber()
  id_operation: number;

  @ApiProperty({
    description: 'IDs de los usuarios encargados a remover',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];
}