import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatusOperation } from '@prisma/client';

@Injectable()
export class CancelledOperationsCleanupService {
  private readonly logger = new Logger(CancelledOperationsCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ejecuta cada día a las 00:00 para limpiar operaciones canceladas y desactivadas
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupCancelledOperations() {
    this.logger.log('Iniciando limpieza de operaciones canceladas y desactivadas...');
    
    try {
      this.logger.log(' Buscando TODAS las operaciones canceladas y desactivadas (sin límite de fecha)');

      // Buscar TODAS las operaciones canceladas Y desactivadas (sin filtro de fecha)
      const operationsToDelete = await this.prisma.operation.findMany({
        where: {
          status: {
            in: [StatusOperation.CANCELED, StatusOperation.DEACTIVATED]
          }
          // Removido el filtro de updateAt
        },
        select: {
          id: true,
          status: true,
          updateAt: true // Para debugging
        }
      });

      if (operationsToDelete.length === 0) {
        this.logger.log(' No hay operaciones canceladas o desactivadas para eliminar');
        return;
      }

      // Contar por estado para mejor logging
      const cancelledCount = operationsToDelete.filter(op => op.status === StatusOperation.CANCELED).length;
      const deactivatedCount = operationsToDelete.filter(op => op.status === StatusOperation.DEACTIVATED).length;

      this.logger.log(` Encontradas ${operationsToDelete.length} operaciones para eliminar:`);
      this.logger.log(` ${cancelledCount} CANCELED`);
      this.logger.log(` ${deactivatedCount} DEACTIVATED`);

      // Log de algunas operaciones para debugging
      operationsToDelete.slice(0, 3).forEach(op => {
        this.logger.log(` ID: ${op.id}, Estado: ${op.status}, Última actualización: ${op.updateAt}`);
      });

      // Eliminar cada operación con sus dependencias
      let deletedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const operation of operationsToDelete) {
        try {
          await this.deleteOperationWithDependencies(operation.id);
          deletedCount++;
          this.logger.log(` Operación eliminada: ID ${operation.id} (Estado: ${operation.status})`);
        } catch (error) {
          if (error.message.includes('no se puede eliminar porque tiene')) {
            skippedCount++;
            this.logger.warn(`Operación omitida: ID ${operation.id} - ${error.message}`);
          } else {
            errorCount++;
            this.logger.error(` Error eliminando operación ID ${operation.id} (Estado: ${operation.status}):`, error.message);
          }
        }
      }

      this.logger.log(` Limpieza completada:`);
      this.logger.log(`    ${deletedCount} eliminadas`);
      this.logger.log(`    ${skippedCount} omitidas (tienen datos críticos)`);
      this.logger.log(`    ${errorCount} errores`);
      this.logger.log(`    ${operationsToDelete.length} total procesadas`);

    } catch (error) {
      this.logger.error(' Error durante la limpieza de operaciones:', error.message);
      this.logger.error('Stack trace:', error.stack);
    }
  }

  /**
   * Elimina una operación y todas sus dependencias en el orden correcto
   * Solo si la operación no tiene registros críticos como facturas o alimentación
   */
  private async deleteOperationWithDependencies(operationId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener la operación para verificar relaciones
      const operation = await tx.operation.findUnique({
        where: { id: operationId },
        select: { 
          id_clientProgramming: true,
          id: true
        }
      });

      if (!operation) {
        throw new Error(`Operación ${operationId} no encontrada`);
      }

      // 2. VALIDACIÓN CRÍTICA: Verificar si tiene facturas
      const existingBills = await tx.bill.count({
        where: { id_operation: operationId }
      });

      if (existingBills > 0) {
        throw new Error(`Operación ${operationId} no se puede eliminar porque tiene ${existingBills} factura(s) asociada(s)`);
      }

      // 3. VALIDACIÓN CRÍTICA: Verificar si tiene registros de alimentación
      const existingFeedings = await tx.workerFeeding.count({
        where: { id_operation: operationId }
      });

      if (existingFeedings > 0) {
        throw new Error(`Operación ${operationId} no se puede eliminar porque tiene ${existingFeedings} registro(s) de alimentación`);
      }

      // 4. VALIDACIÓN ADICIONAL: Verificar si tiene BillDetail
      const operationWorkers = await tx.operation_Worker.findMany({
        where: { id_operation: operationId },
        select: { id: true }
      });

      let totalBillDetails = 0;
      for (const opWorker of operationWorkers) {
        const billDetailCount = await tx.billDetail.count({
          where: { id_operation_worker: opWorker.id }
        });
        totalBillDetails += billDetailCount;
      }

      if (totalBillDetails > 0) {
        throw new Error(`Operación ${operationId} no se puede eliminar porque tiene ${totalBillDetails} detalle(s) de factura`);
      }

      // 5. Eliminar Operation_Worker
      await tx.operation_Worker.deleteMany({
        where: { id_operation: operationId }
      });

      // 6. Eliminar InChargeOperation
      await tx.inChargeOperation.deleteMany({
        where: { id_operation: operationId }
      });

      // 7. Eliminar ClientProgramming si existe relación
      if (operation.id_clientProgramming) {
        try {
          await tx.clientProgramming.delete({
            where: { id: operation.id_clientProgramming }
          });
        } catch (error) {
          // No es crítico si falla
        }
      }

      // 8. Finalmente eliminar la operación
      await tx.operation.delete({
        where: { id: operationId }
      });
      
    }, {
      timeout: 60000,
    });
  }

  /**
   * Método manual para limpiar operaciones canceladas y desactivadas
   */
  async manualCleanup(includeDeactivated: boolean = true, useDateFilter: boolean = false, daysOld: number = 30) {
    const statusesToClean = includeDeactivated 
      ? [StatusOperation.CANCELED, StatusOperation.DEACTIVATED]
      : [StatusOperation.CANCELED];

    const dateFilterText = useDateFilter ? `con filtro de ${daysOld} días` : 'sin filtro de fecha';
    this.logger.log(`🔧 Ejecutando limpieza manual ${dateFilterText} - Estados: ${statusesToClean.join(', ')}`);
    
    const whereCondition: any = {
      status: {
        in: statusesToClean
      }
    };

    // Solo agregar filtro de fecha si se especifica
    if (useDateFilter) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      whereCondition.updateAt = {
        lt: cutoffDate
      };
    }

    const operationsToDelete = await this.prisma.operation.findMany({
      where: whereCondition,
      select: {
        id: true,
        status: true
      }
    });

    let deletedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const operation of operationsToDelete) {
      try {
        await this.deleteOperationWithDependencies(operation.id);
        deletedCount++;
      } catch (error) {
        if (error.message.includes('no se puede eliminar porque tiene')) {
          skippedCount++;
        } else {
          errorCount++;
          this.logger.error(`Error eliminando operación ID ${operation.id}:`, error.message);
        }
      }
    }

    return {
      message: `${deletedCount} operaciones eliminadas, ${skippedCount} omitidas, ${errorCount} errores`,
      deletedCount,
      skippedCount,
      errorCount,
      totalFound: operationsToDelete.length,
      statusesCleaned: statusesToClean,
      usedDateFilter: useDateFilter
    };
  }

  /**
   * Método para verificar qué operaciones pueden eliminarse
   */
  async getCleanupPreview(useDateFilter: boolean = false, daysOld: number = 30) {
    const whereCondition: any = {
      status: {
        in: [StatusOperation.CANCELED, StatusOperation.DEACTIVATED]
      }
    };

    // Solo agregar filtro de fecha si se especifica
    if (useDateFilter) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      whereCondition.updateAt = {
        lt: cutoffDate
      };
    }

    const operations = await this.prisma.operation.findMany({
      where: whereCondition,
      select: {
        id: true,
        status: true,
        updateAt: true,
        Bill: { select: { id: true } },
        feeding: { select: { id: true } },
        workers: {
          select: {
            id: true,
            billDetail: { select: { id: true } }
          }
        }
      }
    });

    const canDelete: { id: number; status: StatusOperation; updateAt: Date }[] = [];
    const cannotDelete: { id: number; status: StatusOperation; updateAt: Date; reason: string }[] = [];

    for (const op of operations) {
      const hasBills = op.Bill.length > 0;
      const hasFeeding = op.feeding.length > 0;
      const hasBillDetails = op.workers.some(w => w.billDetail.length > 0);

      if (hasBills || hasFeeding || hasBillDetails) {
        cannotDelete.push({
          id: op.id,
          status: op.status,
          updateAt: op.updateAt,
          reason: hasBills ? 'Tiene facturas' : hasFeeding ? 'Tiene alimentación' : 'Tiene detalles de factura'
        });
      } else {
        canDelete.push({
          id: op.id,
          status: op.status,
          updateAt: op.updateAt
        });
      }
    }

    return {
      dateFilter: useDateFilter ? `${daysOld} días` : 'Sin filtro de fecha',
      total: operations.length,
      canDelete: canDelete.length,
      cannotDelete: cannotDelete.length,
      details: {
        canDelete,
        cannotDelete
      }
    };
  }
}