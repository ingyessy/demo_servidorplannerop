import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { StatusComplete } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateClientProgrammingDto {
  @ApiProperty({ example: '2079318XX' })
  @IsString()
  service_request: string;

  @ApiProperty({ example: 'LLENADO CARGA' })
  @IsString()
  service: string;

  @ApiProperty({ example: '2021-09-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateStart debe tener formato YYYY-MM-DD',
  })
  dateStart: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/, {
    message: 'timeStrat debe tener formato HH:MM',
  })
  timeStart: string;

  @ApiProperty({ example: 'Z1' })
  @IsString()
  ubication: string;

  @ApiProperty({ example: 'S.A.S' })
  @IsString()
  client: string;

  @ApiProperty({ example: `${Object.values(StatusComplete).join(', ')}` })
  @IsEnum(StatusComplete, {
    message: `status debe ser uno de los siguientes valores: ${Object.values(StatusComplete).join(', ')}`,
  })
  @IsOptional()
  status?: StatusComplete;

  @ApiHideProperty()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_user: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_site: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id_subsite: number;
}

