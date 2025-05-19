import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

interface WorkerDistribution {
  hour: string;
  workerIds: number[];
}
@Injectable()
export class WorkerAnalyticsService {
  constructor(private prisma: PrismaService) { }

  /**
   * Calcula la distribución de trabajadores por hora en un día específico.
   * @param date Fecha para la cual se desea calcular la distribución.
   * @returns Un objeto que contiene la fecha y la distribución de trabajadores por hora.
   */
  async getWorkerDistributionByHour(date: Date): Promise<any> {
    // Crea una fecha de inicio y fin para el día
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Formatea la fecha a YYYY-MM-DD para la respuesta
    const dateStr = date.toISOString().split('T')[0];

    // Encuentra todas las asignaciones de trabajadores activas durante este día
    const workers = await this.prisma.operation_Worker.findMany({
      where: {
        OR: [
          // Caso 1: La operación comenzó en este día específico
          {
            dateStart: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          // Caso 2: La operación abarca varios días, incluyendo este
          {
            dateStart: { lte: endOfDay },
            dateEnd: { gte: startOfDay }
          }
        ]
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            dni: true,
          }
        },
        operation: {
          select: {
            id: true,
            timeStrat: true,
            timeEnd: true,
          }
        }
      }
    });

    // Crea un arreglo para almacenar la distribución de trabajadores por hora
    // Cada índice representa una hora del día (0-23)
    const hourlyDistribution: WorkerDistribution[] = Array(24).fill(0).map((_, i) => ({
      hour: `${i}:00-${i + 1}:00`,
      workerIds: [], 
    }));

    // Creamos un mapa para almacenar trabajadores únicos
    const uniqueWorkers = new Map();

    // Contamos trabajadores en cada hora
    for (const assignment of workers) {
      // Omitir asignaciones sin horas de inicio o fin
      if (!assignment.timeStart || !assignment.timeEnd) continue;

      // Almacenar trabajador único
      if (!uniqueWorkers.has(assignment.worker.id)) {
        uniqueWorkers.set(assignment.worker.id, {
          id: assignment.worker.id,
          name: assignment.worker.name,
          dni: assignment.worker.dni
        });
      }

      // Parsear horas de inicio y fin
      const [startHourStr, ] = assignment.timeStart.split(':');
      const [endHourStr, ] = assignment.timeEnd.split(':');

      const startHour = parseInt(startHourStr, 10);
      const endHour = parseInt(endHourStr, 10);

      // Por cada hora del día (0-23), verificar si este trabajador está activo durante esa hora
      for (let hourOfDay = 0; hourOfDay < 24; hourOfDay++) {
        // Verificar si este es realmente un turno nocturno (hora de finalización al día siguiente)
        const isOvernightShift = assignment.dateEnd &&
          assignment.dateEnd.getTime() > assignment.dateStart!.getTime();

        let isWorkerActiveInThisHour = false;

        if (isOvernightShift && endHour < startHour) {
          // Caso especial: el turno abarca la medianoche
          isWorkerActiveInThisHour = (hourOfDay >= startHour || hourOfDay < endHour);
        } else {
          // Caso general
          isWorkerActiveInThisHour = (hourOfDay >= startHour && hourOfDay < endHour);
        }

        if (isWorkerActiveInThisHour) {
          // Agregar el ID del trabajador a la distribución de esta hora
          if (!hourlyDistribution[hourOfDay].workerIds.includes(assignment.worker.id)) {
            hourlyDistribution[hourOfDay].workerIds.push(assignment.worker.id);
          }

        }
      }
    }

    return {
      date: dateStr,
      workers: Array.from(uniqueWorkers.values()), // Agregar arreglo de trabajadores únicos
      distribution: hourlyDistribution
    };
  }


  /**
   * Get total hours worked per worker in a month
   */
  async getWorkerHoursReport(month: number, year: number): Promise<any> {
    // Beginning and end of the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const workers = await this.prisma.worker.findMany({
      where: {
        operations: {
          some: {
            dateStart: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      },
      include: {
        operations: {
          where: {
            dateStart: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    return workers.map(worker => {
      // Calculate total hours and days
      const workDays = new Set();
      let totalHours = 0;

      worker.operations.forEach(op => {
        if (!op.timeStart || !op.timeEnd || !op.dateStart) return;

        // Add day to unique days worked
        workDays.add(op.dateStart.toISOString().split('T')[0]);

        // Calculate hours for this assignment
        const [startHour, startMin] = op.timeStart.split(':').map(Number);
        const [endHour, endMin] = op.timeEnd.split(':').map(Number);

        let hours = endHour - startHour;
        // Handle overnight shifts
        if (hours < 0) hours += 24;

        const minuteFraction = (endMin - startMin) / 60;
        totalHours += hours + minuteFraction;
      });

      return {
        workerId: worker.id,
        name: worker.name,
        totalHours: parseFloat(totalHours.toFixed(2)),
        daysWorked: workDays.size,
        averageHoursPerDay: workDays.size > 0 ? parseFloat((totalHours / workDays.size).toFixed(2)) : 0
      };
    });
  }
}