import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ConfirmOperationDto {
  @ApiProperty({
    description: 'Token de confirmacion asociado a la operacion especial',
    example: 'f72a7c54b9a5241f57f7e13239a25d33a2e95b8b17c0687c',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Accion de confirmacion',
    enum: ['APPROVE', 'REJECT'],
    example: 'APPROVE',
  })
  @IsEnum(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiProperty({
    description: 'Observacion asociada a la confirmacion',
    required: false,
    example: 'Aprobado por el supervisor de turno',
  })
  @IsOptional()
  @IsString()
  observation?: string;
}