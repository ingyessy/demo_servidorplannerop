import { ApiProperty } from "@nestjs/swagger";
import { CauseDisability, TypeDisability } from "@prisma/client"
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Matches } from "class-validator"


export class CreateInabilityDto {
    @ApiProperty({ example: '2021-09-01' })
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'dateDisableStart debe tener formato YYYY-MM-DD',
    })
    dateDisableStart: string;
  
    @ApiProperty({ example: '2021-10-01' })
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'dateDisableEnd debe tener formato YYYY-MM-DD',
    })
    dateDisableEnd: string;

    @ApiProperty({example:`${Object.values(TypeDisability).join(', ')}` })
    @IsEnum(TypeDisability, {
      message: `type debe ser uno de los siguientes valores: ${Object.values(TypeDisability).join(', ')}`,}) 
    type: TypeDisability

    @ApiProperty({example:`${Object.values(CauseDisability).join(', ')}` })
    @IsEnum(CauseDisability, {
      message: `cause debe ser uno de los siguientes valores: ${Object.values(CauseDisability).join(', ')}`,})
    cause:CauseDisability

    @ApiProperty({ example: '128' })
    @Type(() => Number)
    @IsNumber()
    id_worker: number
}
