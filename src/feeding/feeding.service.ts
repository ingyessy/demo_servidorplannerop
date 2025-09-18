import { Injectable } from '@nestjs/common';
import { CreateFeedingDto } from './dto/create-feeding.dto';
import { UpdateFeedingDto } from './dto/update-feeding.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { FilterWorkerFeedingDto } from './dto/filter-worker-feeding.dto';
import { PaginationFeedingService } from 'src/common/services/pagination/feeding/pagination-feeding.service';

@Injectable()
export class FeedingService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
    private paginationService: PaginationFeedingService,
  ) {}

  /**
   * Determina qué comidas están disponibles basado en la fecha de inicio de la operación y la fecha actual
   */
  private getAvailableMealTypes(operationDateStart: Date, operationTimeStart: string): string[] {
    const now = new Date();
    
    // Crear la fecha y hora de inicio de la operación combinando dateStart y timeStrat
    const [hours, minutes] = operationTimeStart.split(':').map(Number);
    const operationStart = new Date(operationDateStart);
    operationStart.setHours(hours, minutes, 0, 0);
    
    // Obtener solo la fecha (sin hora) para comparar días
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const operationStartDate = new Date(operationStart.getFullYear(), operationStart.getMonth(), operationStart.getDate());
    
    const availableMeals: string[] = [];
    
    // Si es el mismo día que inició la operación, usar la hora de inicio
    if (todayDate.getTime() === operationStartDate.getTime()) {
      const startHour = operationStart.getHours();
      const startMinutes = operationStart.getMinutes();
      const startTotalMinutes = startHour * 60 + startMinutes;
      
      // Horarios de comidas en minutos desde medianoche
      const breakfastEnd = 10 * 60; // 10:00 AM
      const lunchEnd = 15 * 60; // 3:00 PM
      const dinnerEnd = 21 * 60; // 9:00 PM
      
      if (startTotalMinutes <= breakfastEnd) {
        availableMeals.push('BREAKFAST');
      }
      if (startTotalMinutes <= lunchEnd) {
        availableMeals.push('LUNCH');
      }
      if (startTotalMinutes <= dinnerEnd) {
        availableMeals.push('DINNER');
      }
      
      // Snack siempre disponible
      availableMeals.push('SNACK');
      
    } else if (todayDate.getTime() > operationStartDate.getTime()) {
      // Para días posteriores al inicio, usar la hora actual
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinutes;
      
      // Horarios de comidas en minutos desde medianoche
      const breakfastStart = 6 * 60; // 6:00 AM
      const breakfastEnd = 10 * 60; // 10:00 AM
      const lunchStart = 12 * 60; // 12:00 AM
      const lunchEnd = 15 * 60; // 3:00 PM
      const dinnerStart = 17 * 60; // 5:00 PM
      const dinnerEnd = 21 * 60; // 9:00 PM
      
      if (currentTotalMinutes >= breakfastStart && currentTotalMinutes <= breakfastEnd) {
        availableMeals.push('BREAKFAST');
      }
      if (currentTotalMinutes >= lunchStart && currentTotalMinutes <= lunchEnd) {
        availableMeals.push('LUNCH');
      }
      if (currentTotalMinutes >= dinnerStart && currentTotalMinutes <= dinnerEnd) {
        availableMeals.push('DINNER');
      }
      
      // Snack siempre disponible durante horas laborales
      if (currentTotalMinutes >= breakfastStart && currentTotalMinutes <= dinnerEnd) {
        availableMeals.push('SNACK');
      }
    }
    
    return availableMeals;
  }

  async create(createFeedingDto: CreateFeedingDto, id_site?: number) {
    try {
      const validation = await this.validation.validateAllIds({
        workerIds: [createFeedingDto.id_worker],
        id_operation: createFeedingDto.id_operation,
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }

      if (id_site !== undefined) {
        const workerValidation = validation?.existingWorkers?.[0];
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to create feeding for this worker',
            status: 409,
          };
        }
        const operationValidation = validation['operation'].id_site;
        if (operationValidation && operationValidation !== id_site) {
          return {
            message: 'Not authorized to create feeding for this operation',
            status: 409,
          };
        }
      }

      const operation = validation['operation'];
      const availableMealTypes = this.getAvailableMealTypes(operation.dateStart, operation.timeStrat);

      // Validar horario solo si la comida NO es una faltante anterior
      if (!availableMealTypes.includes(createFeedingDto.type)) {
        // Consultar comidas faltantes anteriores
        const missingMeals = await this.getMissingMealsForOperation(createFeedingDto.id_operation);
        const isMissingMeal = missingMeals.some(worker =>
          worker.workerId === createFeedingDto.id_worker &&
          worker.missingMeals.includes(createFeedingDto.type)
        );

        if (!isMissingMeal) {
          const feedingTypeNames = {
            BREAKFAST: 'desayuno',
            LUNCH: 'almuerzo',
            DINNER: 'cena',
            SNACK: 'refrigerio',
          };
          return {
            message: `El ${feedingTypeNames[createFeedingDto.type]} no está disponible en este momento. Comidas disponibles: ${availableMealTypes.map(type => feedingTypeNames[type]).join(', ')}`,
            status: 409,
          };
        }
        // Si es una comida faltante, permitir registrar aunque no esté en horario
      }

      // **VALIDACIÓN EXISTENTE**: Verificar si el trabajador ya tiene una alimentación del mismo tipo hoy
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const existingFeeding = await this.prisma.workerFeeding.findFirst({
        where: {
          id_worker: createFeedingDto.id_worker,
          type: createFeedingDto.type,
          dateFeeding: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (existingFeeding) {
        const feedingTypeNames = {
          BREAKFAST: 'desayuno',
          LUNCH: 'almuerzo',
          DINNER: 'cena',
          SNACK: 'refrigerio',
        };

        return {
          message: `El trabajador ya tiene registrado un ${feedingTypeNames[createFeedingDto.type]} para el día de hoy`,
          status: 409,
        };
      }

      // Separar la propiedad forceMissingMeal si existe
      const { forceMissingMeal, ...feedingData } = createFeedingDto;
      const response = await this.prisma.workerFeeding.create({
        data: {
          ...feedingData,
          id_worker: createFeedingDto.id_worker,
          id_operation: createFeedingDto.id_operation,
          // Si no viene dateFeeding, usar la fecha actual
          dateFeeding: createFeedingDto.dateFeeding
            ? new Date(createFeedingDto.dateFeeding)
            : new Date(),
        },
      });
      if (!response) {
        return { message: 'Feeding not created', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
   * Método público para obtener las comidas disponibles para una operación
   */
  async getAvailableMealsForOperation(operationId: number) {
    try {
      const operation = await this.prisma.operation.findUnique({
        where: { id: operationId },
        select: { 
          dateStart: true, 
          timeStrat: true, // Nota: parece ser un typo en el schema, debería ser "timeStart"
          status: true 
        },
      });

      if (!operation) {
        return { message: 'Operation not found', status: 404 };
      }

      const availableMealTypes = this.getAvailableMealTypes(operation.dateStart, operation.timeStrat);
      
      const feedingTypeNames = {
        BREAKFAST: 'desayuno',
        LUNCH: 'almuerzo',
        DINNER: 'cena',
        SNACK: 'refrigerio',
      };

      // Crear la fecha y hora de inicio completa para la respuesta
      const [hours, minutes] = operation.timeStrat.split(':').map(Number);
      const operationStartDateTime = new Date(operation.dateStart);
      operationStartDateTime.setHours(hours, minutes, 0, 0);

      return {
        availableMeals: availableMealTypes,
        availableMealNames: availableMealTypes.map(type => feedingTypeNames[type]),
        operationStartDate: operation.dateStart,
        operationStartTime: operation.timeStrat,
        operationStartDateTime: operationStartDateTime,
        currentTime: new Date(),
      };
    } catch (error) {
      throw new Error(error);
    }
  }

  // async findAll(id_site?: number) {
  //   try {
  //     const response = await this.prisma.workerFeeding.findMany({
  //       where: { worker: { id_site } },
  //     });
  //     if (!response || response.length === 0) {
  //       return { message: 'No worker feeding records found', status: 404 };
  //     }
  //     return response;
  //   } catch (error) {
  //     throw new Error(error);
  //   }
  // }

 async findAll(id_site?: number, id_subsite?: number | null) {
  try {
    const whereClause: any = {};

    // Siempre filtra por sitio si viene
    if (id_site) {
      whereClause['worker'] = { id_site };
    }

    // Solo filtra por subsede si es un número válido
    if (typeof id_subsite === 'number' && !isNaN(id_subsite)) {
      whereClause['worker'] = {
        ...(whereClause['worker'] || {}),
        id_subsite,
      };
    }

    const response = await this.prisma.workerFeeding.findMany({
      where: whereClause,
      include: {
        operation: {
          select: {
            id: true,
            task: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        worker: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });
    if (!response || response.length === 0) {
      return { message: 'No worker feeding records found', status: 404 };
    }
    return response.map(feeding => ({
      ...feeding,
      serviceName: feeding.operation?.task?.name || null,
      workerName: feeding.worker?.name || null,
    }));
  } catch (error) {
    throw new Error(error.message || String(error));
  }
}

  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.workerFeeding.findUnique({
        where: {
          id,
          worker: {
            id_site,
          },
        },
      });
      if (!response || Object.keys(response).length === 0) {
        return { message: 'Feeding not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: FilterWorkerFeedingDto,
    activatePaginated: boolean = true,
  ) {
    try {
      // Usar el servicio de paginación para feeding
      const paginatedResponse =
        await this.paginationService.paginateWorkerFeeding({
          prisma: this.prisma,
          page,
          limit,
          filters,
          activatePaginated: activatePaginated === false ? false : true,
        });

      // Si no hay resultados, mantener el formato de respuesta de error
      if (paginatedResponse.items.length === 0) {
        return {
          message: 'No worker feeding records found for the requested page',
          status: 404,
          pagination: paginatedResponse.pagination,
          items: [],
          nextPages: [],
        };
      }

      return paginatedResponse;
    } catch (error) {
      console.error('Error finding worker feeding with pagination:', error);
      throw new Error(error.message);
    }
  }

  async findByOperation(id_operation: number, id_site?: number) {
    try {
      const validation = await this.validation.validateAllIds({
        id_operation,
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const response = await this.prisma.workerFeeding.findMany({
        where: {
          id_operation,
          worker: {
            id_site,
          },
        },
      });
      if (!response || response.length === 0) {
        return { message: 'Feeding not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

//  async findByOperation(id_operation: number, id_site?: number) {
//   try {
//     const validation = await this.validation.validateAllIds({
//       id_operation,
//     });
//     // Si la operación no existe, retorna array vacío
//     if (validation && 'status' in validation && validation.status === 404) {
//       return [];
//     }

//     // Construir el filtro de manera dinámica
//     const whereClause: any = { id_operation };
//     if (id_site) {
//       whereClause.worker = { id_site };
//     }

//     const response = await this.prisma.workerFeeding.findMany({
//       where: whereClause,
//       include: {
//         operation: {
//           select: {
//             id: true,
//             task: {
//               select: {
//                 id: true,
//                 name: true, // nombre del servicio/tarea
//               }
//             }
//           }
//         },
//         worker: {
//           select: {
//             id: true,
//             name: true,
//           }
//         }
//       }
//     });

//     // Si no hay registros, retorna array vacío
//     if (!response || response.length === 0) {
//       return [];
//     }

//     // Filtrar registros donde la operación no fue encontrada o no tiene nombre de servicio/tarea
//     const filtered = response.filter(
//       feeding =>
//         feeding.operation &&
//         feeding.operation.task &&
//         feeding.operation.task.name
//     );

//     return filtered.map(feeding => ({
//       ...feeding,
//       serviceName: feeding.operation?.task?.name || null,
//       workerName: feeding.worker?.name || null,
//     }));
//   } catch (error) {
//     throw new Error(error.message || String(error));
//   }
// }
  async update(
    id: number,
    updateFeedingDto: UpdateFeedingDto,
    id_site?: number,
  ) {
    try {
      const validation = await this.validation.validateAllIds({
        id_operation: updateFeedingDto.id_operation,
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const validate = await this.findOne(id);

      if (validate && 'status' in validate && validate.status === 404) {
        return validate;
      }
      if (id_site !== undefined) {
        const workerValidationData = await this.validation.validateAllIds({
          workerIds: [validate['id_worker']],
        });
        const workerValidation = workerValidationData?.existingWorkers?.[0];
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to update feeding for this worker',
            status: 409,
          };
        }
        const operationValidation = validation['operation'].id_site;
        if (operationValidation && operationValidation !== id_site) {
          return {
            message: 'Not authorized to update feeding for this operation',
            status: 409,
          };
        }
      }

      // **NUEVA VALIDACIÓN PARA UPDATE**: Solo validar si se está cambiando el tipo o el trabajador
      if (updateFeedingDto.type && updateFeedingDto.type !== validate['type']) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const existingFeeding = await this.prisma.workerFeeding.findFirst({
          where: {
            id_worker: updateFeedingDto.id_worker || validate['id_worker'],
            type: updateFeedingDto.type,
            dateFeeding: {
              gte: startOfDay,
              lte: endOfDay,
            },
            NOT: {
              id: id, // Excluir el registro actual
            },
          },
        });

        if (existingFeeding) {
          const feedingTypeNames = {
            BREAKFAST: 'desayuno',
            LUNCH: 'almuerzo',
            DINNER: 'cena',
            SNACK: 'refrigerio',
          };

          return {
            message: `El trabajador ya tiene registrado un ${feedingTypeNames[updateFeedingDto.type]} para el día de hoy`,
            status: 409,
          };
        }
      }

      const response = await this.prisma.workerFeeding.update({
        where: {
          id,
        },
        data: {
          ...updateFeedingDto,
          id_worker: updateFeedingDto.id_worker,
          id_operation: updateFeedingDto.id_operation,
          // Actualizar dateFeeding si viene en el DTO
          ...(updateFeedingDto.dateFeeding && {
            dateFeeding: new Date(updateFeedingDto.dateFeeding),
          }),
        },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async remove(id: number, id_site?: number) {
    try {
      const validate = await this.findOne(id);
      if (validate && 'status' in validate && validate.status === 404) {
        return validate;
      }
      if (id_site !== undefined) {
        const workerValidationData = await this.validation.validateAllIds({
          workerIds: [validate['id_worker']],
        });
        const workerValidation = workerValidationData?.existingWorkers?.[0];
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to delete feeding for this worker',
            status: 409,
          };
        }
      }
      const response = await this.prisma.workerFeeding.delete({
        where: {
          id,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  /**
 * Retorna las alimentaciones faltantes por trabajador en una operación para el día actual
 */
async getMissingMealsForOperation(operationId: number) {
  // Obtener la operación y sus trabajadores
  const operation = await this.prisma.operation.findUnique({
    where: { id: operationId },
    include: { workers: { include: { worker: true } } },
  });
  if (!operation) return [];

  // Tipos de alimentación en orden
  const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK' ];
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Detectar la comida actual
  const availableMeals = this.getAvailableMealTypes(operation.dateStart, operation.timeStrat);
  // Tomar la comida actual (la última disponible en el horario actual)
  const currentMealIndex = mealTypes.findIndex(type => availableMeals.includes(type));
  // Si no hay comida actual, no mostrar nada
  if (currentMealIndex === -1) return [];

  const result: { workerId: number; workerName: string; missingMeals: string[] }[] = [];
  for (const opWorker of operation.workers) {
    const feedings = await this.prisma.workerFeeding.findMany({
      where: {
        id_worker: opWorker.id_worker,
        dateFeeding: { gte: startOfDay, lte: endOfDay },
      },
    });
    // Solo las comidas anteriores a la actual
    const missing = mealTypes
      .slice(0, currentMealIndex)
      .filter(type => !feedings.some(f => f.type === type));
    if (missing.length > 0) {
      result.push({
        workerId: opWorker.id_worker,
        workerName: opWorker.worker.name,
        missingMeals: missing,
      });
    }
  }
  return result;
}
}
