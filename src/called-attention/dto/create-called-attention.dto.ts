import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Failures } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateCalledAttentionDto {
     @ApiProperty({ 
    description: 'DNI del trabajador',
    example: '12345678'
  })
  @Transform(({ value }) => {
    // ✅ CONVERTIR A STRING SI VIENE COMO NÚMERO
    if (typeof value === 'number') {
      return value.toString();
    }
    return value;
  })
  @IsString()
  @IsNotEmpty()
  dni_worker: string;

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

    
}
