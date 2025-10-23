import { Controller, Post, Body, Delete, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { OperationInChargeService } from './in-charged.service';
import { AssignInChargeDto } from './dto/assign-in-charge.dto';
import { RemoveInChargeDto } from './dto/remove-in-charge.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Operation In Charge')
@Controller('operation-in-charge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OperationInChargeController {
  constructor(private readonly operationInChargeService: OperationInChargeService) {}

  @Post('assign')
  @ApiOperation({ summary: 'Asignar encargados a una operación' })
  @ApiResponse({ status: 201, description: 'Encargados asignados exitosamente' })
  @ApiResponse({ status: 404, description: 'Operación o usuarios no encontrados' })
  assignInCharge(@Body() assignDto: AssignInChargeDto) {
    return this.operationInChargeService.assignInChargeToOperation(assignDto);
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remover encargados de una operación' })
  @ApiResponse({ status: 200, description: 'Encargados removidos exitosamente' })
  @ApiResponse({ status: 404, description: 'Operación o usuarios no encontrados' })
  removeInCharge(@Body() removeDto: RemoveInChargeDto) {
    return this.operationInChargeService.removeInChargeFromOperation(removeDto);
  }

  @Get(':id_operation/users')
  @ApiOperation({ summary: 'Obtener encargados asignados a una operación' })
  @ApiResponse({ status: 200, description: 'Listado de encargados' })
  @ApiResponse({ status: 404, description: 'Operación no encontrada' })
  getInChargeUsers(@Param('id_operation', ParseIntPipe) id_operation: number) {
    return this.operationInChargeService.getInChargeUsersFromOperation(id_operation);
  }
}