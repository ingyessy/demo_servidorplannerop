import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';

export class AssignInChargeDto {
  @ApiProperty({
    description: 'ID de la operación a la que se asignarán encargados',
    example: 1
  })
  @IsNumber()
  id_operation: number;

  @ApiProperty({
    description: 'IDs de los usuarios encargados a asignar',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  userIds: number[];
}