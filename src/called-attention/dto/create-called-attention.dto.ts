import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Failures } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateCalledAttentionDto {
    @ApiProperty({ example: 'Falta de respecto' })
    @IsString()
    description: string;

    @ApiHideProperty()
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    id_user?: number;

    @ApiProperty({ example: `${Object.values(Failures).join(', ')}` })
    @IsOptional() 
    @IsEnum(Failures,{
        message:`type debe ser uno de los siguientes valores: ${Object.values(Failures).join(', ')}`,
    })
    type: Failures

    @ApiProperty({ example: '21' })
    @IsNumber()
    @Type(() => Number)
    id_worker: number;
}
