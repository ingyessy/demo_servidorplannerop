import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpdateOperationService } from './services/update-operation.service';
import { UpdateWorkerService } from './services/update-worker.service';
import { UpdateOperationWorkerService } from './services/update-operation-worker.service';
/**
 * Servicio para gestionar Cron Jobs
 * @class OperationsCronService
 */
@Injectable()
export class OperationsCronService {
  private readonly logger = new Logger(OperationsCronService.name);

  constructor(
    private updateOperation: UpdateOperationService,
    private updateWorker: UpdateWorkerService,
    private updateOperationWorker: UpdateOperationWorkerService,
  ) {}
  /**
   * Actualiza las operaciones en progreso
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUpdateInProgressOperations() {
    try {
      await this.updateOperation.updateInProgressOperations();
    } catch (error) {
      this.logger.error('Error in cron job:', error);
    }
  }
  /**
   * Actualiza los trabajadores deshabilitados
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUpdateDisabledWorkers() {
    try {
      await this.updateWorker.updateDisabledWorkers();
    } catch (error) {
      this.logger.error('Error in cron job:', error);
    }
  }
  /**
   * Actualiza las operaciones completadas
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUpdateCompletedOperations() {
    try {
      await this.updateOperation.updateCompletedOperations();
    } catch (error) {
      this.logger.error('Error in cron job:', error);
    }
  }

  /**
   * Actulizar trabajadores con fallas
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleUpdateWorkersWithFailures() {
    try {
      await this.updateWorker.updateWorkerFailures();
    } catch (error) {
      this.logger.error('Error in cron job:', error);
    }
  }

  /**
   * Actualizar trabajadores según su programación
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUpdateWorkersScheduleState() {
    try {
      await this.updateOperationWorker.updateWorkersScheduleState();
    } catch (error) {
      this.logger.error('Error in cron job:', error);
    }
  }
}
