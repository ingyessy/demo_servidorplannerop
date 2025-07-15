import { Controller, Post, Body, Delete, Param, Get, ParseIntPipe, UseGuards, UsePipes } from '@nestjs/common';
import { OperationWorkerService } from './operation-worker.service';
import { AssignWorkersDto } from './dto/assign-workers.dto';
import { RemoveWorkersDto } from './dto/remove-workers.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';

@ApiTags('Operation Workers')
@Controller('operation-worker')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OperationWorkerController {
  constructor(private readonly operationWorkerService: OperationWorkerService) {}

  @Post('assign')
  @ApiOperation({ summary: 'Asignar trabajadores a una operación' })
  @ApiResponse({ status: 201, description: 'Trabajadores asignados exitosamente' })
  @ApiResponse({ status: 404, description: 'Operación o trabajadores no encontrados' })
  @UsePipes(new DateTransformPipe())
  assignWorkers(@Body() assignWorkersDto: AssignWorkersDto) {
    return this.operationWorkerService.assignWorkersToOperation(assignWorkersDto);
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remover trabajadores de una operación' })
  @ApiResponse({ status: 200, description: 'Trabajadores removidos exitosamente' })
  @ApiResponse({ status: 404, description: 'Operación o trabajadores no encontrados' })
  removeWorkers(@Body() removeWorkersDto: RemoveWorkersDto) {
    return this.operationWorkerService.removeWorkersFromOperation(removeWorkersDto);
  }

  @Delete(':id_operation/release-all')
  @ApiOperation({ summary: 'Liberar todos los trabajadores de una operación' })
  @ApiResponse({ status: 200, description: 'Trabajadores liberados exitosamente' })
  @ApiResponse({ status: 404, description: 'Operación no encontrada' })
  releaseAllWorkers(@Param('id_operation', ParseIntPipe) id_operation: number) {
    return this.operationWorkerService.releaseAllWorkersFromOperation(id_operation);
  }

  @Get(':id_operation/workers')
  @ApiOperation({ summary: 'Obtener trabajadores asignados a una operación' })
  @ApiResponse({ status: 200, description: 'Listado de trabajadores' })
  @ApiResponse({ status: 404, description: 'Operación no encontrada' })
  getWorkers(@Param('id_operation', ParseIntPipe) id_operation: number) {
    return this.operationWorkerService.getWorkersFromOperation(id_operation);
  }
}