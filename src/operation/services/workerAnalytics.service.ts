import { Injectable } from '@nestjs/common';
import { StatusOperation } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface WorkerDistribution {
  hour: string;
  count: number;
  workers: Array<{ id: number; name: string; dni: string }>;
  idsOperations: number[];
}

@Injectable()
export class WorkerAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula la distribución de trabajadores por hora en un día específico.
   * Incluye trabajadores de operaciones programadas y en curso.
   * @param date Fecha para la cual se desea calcular la distribución.
   * @returns Un objeto que contiene la fecha y la distribución de trabajadores por hora.
   */
  async getWorkerDistributionByHour(
    date: string,
    id_site?: number,
    id_subsite?: number,
  ): Promise<any> {
    // Usar formato YYYY-MM-DD directamente para las comparaciones
    const targetDateStr = date; // Ej: "2025-05-27"

    // Para Prisma, crear fechas específicas pero forzar timezone local
    const [year, month, day] = date.split('-').map(Number);

    // Crear las fechas sin problemas de timezone
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    console.log(id_site, id_subsite);
    // PASO 1: Buscar trabajadores de operaciones PROGRAMADAS para este día
    const scheduledWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        worker: {
          id_site: id_site,
          id_subsite: id_subsite,
        },
        AND: [
          {
            operation: {
              status: {
                not: StatusOperation.CANCELED,
              },
            },
          },

          {
            OR: [
              // Caso 1: Registro que empieza en la fecha consultada
              {
                dateStart: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
              // Caso 2: Registro que termina en la fecha consultada
              {
                AND: [
                  { dateEnd: { gte: startOfDay } },
                  { dateEnd: { lte: endOfDay } },
                ],
              },
              // Caso 3: Registro que abarca completamente la fecha consultada
              {
                AND: [
                  { dateStart: { lte: startOfDay } },
                  { dateEnd: { gte: endOfDay } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            dni: true,
          },
        },
        operation: {
          select: {
            id: true,
            timeStrat: true,
            timeEnd: true,
            status: true,
          },
        },
      },
    });

    // PASO 2: Buscar trabajadores de operaciones EN CURSO (INPROGRESS)
    const inProgressWorkers = await this.prisma.operation_Worker.findMany({
      where: {
        operation: {
          status: StatusOperation.INPROGRESS,
        },
        worker: {
          id_site: id_site,
          id_subsite: id_subsite,
        },
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            dni: true,
          },
        },
        operation: {
          select: {
            id: true,
            timeStrat: true,
            timeEnd: true,
            status: true,
            dateStart: true,
            dateEnd: true,
          },
        },
      },
    });

    // Crear distribución horaria para 24 horas
    const hourlyDistribution: WorkerDistribution[] = Array(24)
      .fill(0)
      .map((_, i) => ({
        hour: `${i}:00-${i + 1}:00`,
        count: 0,
        workers: [],
        idsOperations: [],
      }));

    // PASO 3: Procesar trabajadores programados
    this.processScheduledWorkers(scheduledWorkers, hourlyDistribution);

    // PASO 4: Procesar trabajadores en operaciones en curso
    this.processInProgressWorkers(
      inProgressWorkers,
      hourlyDistribution,
      targetDateStr,
    );

    // Crear la lista única de trabajadores para el resumen
    const allWorkersMap = new Map();

    for (const hour of hourlyDistribution) {
      for (const worker of hour.workers) {
        if (!allWorkersMap.has(worker.id)) {
          allWorkersMap.set(worker.id, {
            id: worker.id,
            name: worker.name,
            dni: worker.dni || 'N/A',
          });
        }
      }
    }

    const trabajadores = Array.from(allWorkersMap.values());

    // Transformar la distribución al formato solicitado
    const distribution = hourlyDistribution.map((hourData, index) => {
      const workerIds = hourData.workers.map((worker) => worker.id);

      return {
        hour: hourData.hour,
        workerIds: workerIds,
      };
    });

    return {
      date: targetDateStr,
      workers: trabajadores,
      distribution: distribution,
    };
  }

  /**
   * Procesa trabajadores de operaciones en curso
   */
  private processInProgressWorkers(
    workers: any[],
    hourlyDistribution: WorkerDistribution[],
    targetDateStr: string, // Cambiar a string
  ) {
    const currentTime = new Date();

    for (const assignment of workers) {
      // Verificar si la operación en curso abarca la fecha consultada
      const operationStartDate = assignment.operation.dateStart;
      const operationEndDate = assignment.operation.dateEnd;

      if (!operationStartDate) continue;

      // Convertir fechas a formato YYYY-MM-DD para comparación directa
      const opStartDateStr = operationStartDate.toISOString().split('T')[0];
      const opEndDateStr = operationEndDate
        ? operationEndDate.toISOString().split('T')[0]
        : null;

      // Verificar si la operación en curso incluye la fecha consultada
      const operationIncludesDate =
        opStartDateStr <= targetDateStr &&
        (opEndDateStr === null || opEndDateStr >= targetDateStr);

      if (!operationIncludesDate) continue;

      // Determinar el estado del trabajador según si ya finalizó o sigue activo
      if (assignment.timeEnd && assignment.dateEnd) {
        // El trabajador YA FINALIZÓ su turno - usar horarios de operation_Worker
        this.processWorkerSchedule(assignment, hourlyDistribution, 'completed');
      } else {
        // El trabajador AÚN ESTÁ EN PROGRESO
        this.processActiveWorker(
          assignment,
          hourlyDistribution,
          targetDateStr,
          currentTime,
        );
      }
    }
  }

  /**
   * Procesa un trabajador que aún está activo (sin hora de finalización)
   */
  private processActiveWorker(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    targetDateStr: string, // Cambiar a string
    currentTime: Date,
  ) {
    const startTime = assignment.timeStart || assignment.operation.timeStrat;
    const endTime = assignment.timeEnd || assignment.operation.timeEnd;

    if (!startTime) return;

    // Crear fecha objetivo para comparar con fecha actual
    const [year, month, day] = targetDateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const isToday = targetDate.toDateString() === currentTime.toDateString();

    // Verificar fechas de inicio usando strings
    const operationStartDate = assignment.operation.dateStart;
    const assignmentStartDate = assignment.dateStart;

    const relevantStartDate = assignmentStartDate || operationStartDate;

    if (!relevantStartDate) return;

    // Comparar fechas como strings para evitar problemas de timezone
    const startDateStr = relevantStartDate.toISOString().split('T')[0];

    const operationStartedBefore = startDateStr < targetDateStr;
    const operationStartedSameDay = startDateStr === targetDateStr;

    if (operationStartedBefore) {
      // CASO 1: Operación empezó en fecha anterior - trabajador activo todo el día
      if (isToday && !endTime) {
        this.processActiveWorkerTodayFullDay(
          assignment,
          hourlyDistribution,
          currentTime,
        );
      } else if (endTime) {
        this.processWorkerTimeRange(
          assignment,
          hourlyDistribution,
          '00:00',
          endTime,
          'active-continued',
        );
      } else {
        this.processWorkerTimeRange(
          assignment,
          hourlyDistribution,
          '00:00',
          '23:59',
          'active-continued',
        );
      }
    } else if (operationStartedSameDay) {
      console.log(`Using specific start time: ${startTime}`);
      // CASO 2: Operación empezó el mismo día - usar hora específica de inicio
      if (isToday && !endTime) {
        this.processActiveWorkerToday(
          assignment,
          hourlyDistribution,
          startTime,
          currentTime,
        );
      } else if (endTime) {
        this.processWorkerTimeRange(
          assignment,
          hourlyDistribution,
          startTime,
          endTime,
          'active-same-day',
        );
      } else {
        this.processWorkerTimeRange(
          assignment,
          hourlyDistribution,
          startTime,
          '23:59',
          'active-same-day',
        );
      }
    } else {
      console.warn(`Operación en progreso con fecha futura: ${startDateStr}`);
    }
  }

  /**
   * Procesa trabajadores de operaciones programadas
   */
  private processScheduledWorkers(
    workers: any[],
    hourlyDistribution: WorkerDistribution[],
  ) {
    for (const assignment of workers) {
      if (!assignment.timeStart || !assignment.timeEnd) continue;

      // Procesar horarios del trabajador
      this.processWorkerSchedule(assignment, hourlyDistribution, 'scheduled');
    }
  }

  /**
   * Procesa un trabajador activo en el día actual desde las 00:00 hasta la hora actual
   */
  private processActiveWorkerTodayFullDay(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    currentTime: Date,
  ) {
    const currentHour = currentTime.getHours();

    // Trabajador activo desde las 00:00 hasta hora actual
    for (let hour = 0; hour <= currentHour; hour++) {
      this.addWorkerToHour(
        assignment,
        hourlyDistribution,
        hour,
        'active-continued-today',
      );
    }
  }
  /**
   * Procesa un trabajador activo en el día actual hasta la hora actual
   */
  private processActiveWorkerToday(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    startTime: string,
    currentTime: Date,
  ) {
    const [startHour] = startTime.split(':').map(Number);
    const currentHour = currentTime.getHours();

    // Trabajador activo desde hora de inicio hasta hora actual
    for (let hour = startHour; hour <= currentHour; hour++) {
      this.addWorkerToHour(
        assignment,
        hourlyDistribution,
        hour,
        'active-today',
      );
    }
  }

  /**
   * Procesa el horario de un trabajador usando timeStart y timeEnd
   */
  private processWorkerSchedule(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    type: string,
  ) {
    const startTime = assignment.timeStart;
    const endTime = assignment.timeEnd;

    this.processWorkerTimeRange(
      assignment,
      hourlyDistribution,
      startTime,
      endTime,
      type,
    );
  }

  /**
   * Procesa un rango de tiempo específico para un trabajador
   */
  private processWorkerTimeRange(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    startTime: string,
    endTime: string,
    type: string,
  ) {
    const [startHour, startMin = 0] = startTime.split(':').map(Number);
    const [endHour, endMin = 0] = endTime.split(':').map(Number);

    // Determinar si es turno nocturno
    const isOvernightShift =
      endHour < startHour || (endHour === startHour && endMin < startMin);

    // Calcular las horas en las que el trabajador está activo
    for (let hour = 0; hour < 24; hour++) {
      let isActiveInHour = false;

      if (isOvernightShift) {
        // Turno nocturno: activo desde startHour hasta 23:59 y desde 00:00 hasta endHour
        isActiveInHour = hour >= startHour || hour < endHour;
      } else {
        // Turno normal: activo desde startHour hasta endHour
        isActiveInHour = hour >= startHour && hour < endHour;

        // Incluir la hora de fin si hay minutos
        if (hour === endHour && endMin > 0) {
          isActiveInHour = true;
        }
      }

      if (isActiveInHour) {
        this.addWorkerToHour(assignment, hourlyDistribution, hour, type);
      }
    }
  }

  /**
   * Agrega un trabajador a una hora específica en la distribución
   */
  private addWorkerToHour(
    assignment: any,
    hourlyDistribution: WorkerDistribution[],
    hour: number,
    type: string,
  ) {
    // Verificar si el trabajador ya está agregado en esta hora
    const workerExists = hourlyDistribution[hour].workers.some(
      (w) => w.id === assignment.worker.id,
    );

    if (!workerExists) {
      hourlyDistribution[hour].workers.push({
        id: assignment.worker.id,
        name: assignment.worker.name,
        dni: assignment.worker.dni || 'N/A',
      });
      hourlyDistribution[hour].count++;
    }

    // Agregar ID de operación si no existe
    if (
      !hourlyDistribution[hour].idsOperations.includes(assignment.operation.id)
    ) {
      hourlyDistribution[hour].idsOperations.push(assignment.operation.id);
    }
  }

  /**
   * Get total hours worked per worker in a month
   */
  async getWorkerHoursReport(
    month: number,
    year: number,
    id_site?: number,
    id_subsite?: number,
  ): Promise<any> {
    // Beginning and end of the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const workerAssignments = await this.prisma.operation_Worker.findMany({
      where: {
        worker: {
          id_site: id_site,
          id_subsite: id_subsite,
        },
        AND: [
          {
            operation: {
              status: {
                not: StatusOperation.CANCELED,
              },
            },
          },
          {
            OR: [
              {
                AND: [
                  { dateStart: { gte: startDate } },
                  { dateStart: { lte: endDate } },
                ],
              },
              {
                AND: [
                  { dateEnd: { gte: startDate } },
                  { dateEnd: { lte: endDate } },
                ],
              },
              {
                AND: [
                  { dateStart: { lte: startDate } },
                  { dateEnd: { gte: endDate } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Agrupar por trabajador
    const workerHoursMap = new Map();

    for (const assignment of workerAssignments) {
      if (!assignment.timeStart || !assignment.timeEnd || !assignment.dateStart)
        continue;

      const workerId = assignment.worker.id;

      if (!workerHoursMap.has(workerId)) {
        workerHoursMap.set(workerId, {
          workerId,
          name: assignment.worker.name,
          totalHours: 0,
          daysWorked: new Set(),
        });
      }

      const workerData = workerHoursMap.get(workerId);

      // Agregar día trabajado
      const dateKey = assignment.dateStart.toISOString().split('T')[0];
      workerData.daysWorked.add(dateKey);

      // Calcular horas trabajadas
      const [startHour, startMin = 0] = assignment.timeStart
        .split(':')
        .map(Number);
      const [endHour, endMin = 0] = assignment.timeEnd.split(':').map(Number);

      let hours = endHour - startHour;
      if (hours < 0) hours += 24; // Turno nocturno

      const minuteFraction = (endMin - startMin) / 60;
      workerData.totalHours += hours + minuteFraction;
    }

    // Convertir a array y agregar promedios
    return Array.from(workerHoursMap.values()).map((worker) => ({
      workerId: worker.workerId,
      name: worker.name,
      totalHours: parseFloat(worker.totalHours.toFixed(2)),
      daysWorked: worker.daysWorked.size,
      averageHoursPerDay:
        worker.daysWorked.size > 0
          ? parseFloat((worker.totalHours / worker.daysWorked.size).toFixed(2))
          : 0,
    }));
  }
}
