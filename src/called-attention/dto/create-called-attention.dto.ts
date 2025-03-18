import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateCalledAttentionDto {
    @IsString()
    @ApiProperty({ example: 'Limpieza de tanque' })
    name: string;

    @ApiProperty({ example: 'Se necesita limpiar el tanque de agua' })
    @IsString()
    description: string;

    @ApiHideProperty()
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    id_user?: number;

    @ApiProperty({ example: '21' })
    @IsNumber()
    @Type(() => Number)
    id_worker: number;
}
