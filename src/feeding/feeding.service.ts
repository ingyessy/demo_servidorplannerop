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
      const breakfastEnd = 7 * 60; // 10:00 AM
      const lunchEnd = 13 * 60; // 3:00 PM
      const dinnerEnd = 19 * 60; // 9:00 PM
      
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
      // const breakfastStart = 6 * 60; // 6:00 AM
      // const breakfastEnd = 10 * 60; // 10:00 AM
      // const lunchStart = 12 * 60; // 12:00 AM
      // const lunchEnd = 15 * 60; // 3:00 PM
      // const dinnerStart = 17 * 60; // 5:00 PM
      // const dinnerEnd = 21 * 60; // 9:00 PM
      const breakfastStart = 6 * 60; // 6:00 AM
      const breakfastEnd = 7 * 60; // 10:00 AM
      const lunchStart = 12 * 60; // 12:00 AM
      const lunchEnd = 13 * 60; // 3:00 PM
      const dinnerStart = 18 * 60; // 5:00 PM
      const dinnerEnd = 19 * 60; // 9:00 PM
      
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
  console.log(`🔍 [DEBUG] getMissingMealsForOperation - Operación ID: ${operationId}`);
  
  // Obtener la operación y sus trabajadores
  const operation = await this.prisma.operation.findUnique({
    where: { id: operationId },
    include: { workers: { include: { worker: true } } },
  });
  if (!operation) return [];

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // ✅ NUEVA LÓGICA: Determinar qué comidas ya deberían haber pasado
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinutes;

  // Obtener fecha y hora de inicio de operación
  const [hours, minutes] = operation.timeStrat.split(':').map(Number);
  
  // ✅ CORREGIR: No modificar la fecha original, crear una nueva instancia local
  const operationStart = new Date(operation.dateStart);
  // ✅ Usar setUTCHours para evitar problemas de zona horaria
  operationStart.setUTCHours(hours, minutes, 0, 0);
  
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // ✅ CORREGIR: Usar directamente la fecha de la operación sin modificaciones
  const operationDateOnly = new Date(operation.dateStart);
  const operationStartDate = new Date(operationDateOnly.getUTCFullYear(), operationDateOnly.getUTCMonth(), operationDateOnly.getUTCDate());
  
  // console.log(`📅 [DEBUG] Fecha inicio operación: ${operation.dateStart.toISOString().split('T')[0]}`);
  // console.log(`🕐 [DEBUG] Hora inicio operación: ${operation.timeStrat}`);
  // console.log(`📅 [DEBUG] Fecha actual: ${todayDate.toISOString().split('T')[0]}`);
  // console.log(`🕐 [DEBUG] Hora actual: ${currentHour}:${currentMinutes} (${currentTotalMinutes} minutos)`);
  
  // ✅ DEBUG ADICIONAL para fechas
  // console.log(`🔍 [DEBUG] operationStart completo: ${operationStart.toISOString()}`);
  // console.log(`🔍 [DEBUG] operation.dateStart original: ${operation.dateStart.toISOString()}`);
  // console.log(`🔍 [DEBUG] todayDate timestamp: ${todayDate.getTime()}`);
  // console.log(`🔍 [DEBUG] operationStartDate timestamp: ${operationStartDate.getTime()}`);
  // console.log(`🔍 [DEBUG] Diferencia en ms: ${todayDate.getTime() - operationStartDate.getTime()}`);
  
  const isFirstDay = todayDate.getTime() === operationStartDate.getTime();
  const daysFromStart = Math.floor((todayDate.getTime() - operationStartDate.getTime()) / (24 * 60 * 60 * 1000));
  console.log(`🎯 [DEBUG] ¿Es primer día?: ${isFirstDay}`);
  console.log(`📊 [DEBUG] Días desde inicio: ${daysFromStart}`);

  // Horarios de comidas (deben coincidir con getAvailableMealTypes)
  const mealSchedule = {
    BREAKFAST: { start: 6 * 60, end: 7 * 60 },     // 6:00 AM - 7:00 AM
    LUNCH: { start: 12 * 60, end: 13 * 60 },       // 12:00 PM - 1:00 PM
    DINNER: { start: 18 * 60, end: 19 * 60 },      // 6:00 PM - 7:00 PM
    SNACK: { start: 23 * 60, end: 24 * 60 },       // 11:00 PM - 12:00 AM
  };

  const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
  let passedMeals: string[] = [];

  // ✅ Si es el mismo día que empezó la operación
  if (isFirstDay) {
    const startTotalMinutes = operationStart.getHours() * 60 + operationStart.getMinutes();
    console.log(`🕐 [DEBUG] PRIMER DÍA - Minutos inicio operación: ${startTotalMinutes}`);
    
    for (const mealType of mealTypes) {
      const schedule = mealSchedule[mealType];
      if (schedule) {
        // ✅ CONDICIONES CORREGIDAS:
        // 1. La operación empezó ANTES del final de esa comida específica
        // 2. El tiempo actual ya pasó el final de esa comida específica  
        const operationStartedBeforeEnd = startTotalMinutes < schedule.end;
        const currentTimePassedEnd = currentTotalMinutes > schedule.end;
        
        // console.log(`🍽️ [DEBUG] ${mealType}:`);
        // console.log(`   - Horario: ${Math.floor(schedule.start/60)}:${(schedule.start%60).toString().padStart(2,'0')} - ${Math.floor(schedule.end/60)}:${(schedule.end%60).toString().padStart(2,'0')}`);
        // console.log(`   - Operación empezó antes del final (${startTotalMinutes} < ${schedule.end}): ${operationStartedBeforeEnd}`);
        // console.log(`   - Tiempo actual pasó el final (${currentTotalMinutes} > ${schedule.end}): ${currentTimePassedEnd}`);
        
        // ✅ LÓGICA CORREGIDA: Solo es faltante si:
        // 1. La operación empezó antes del final de esa comida Y
        // 2. El tiempo actual ya pasó el final de esa comida Y
        // 3. La operación tuvo acceso lógico a esa comida
        if (operationStartedBeforeEnd && currentTimePassedEnd) {
          
          let shouldHaveAccess = false;
          
          if (mealType === 'BREAKFAST') {
            // Breakfast: acceso si empezó antes de las 7:00 AM
            shouldHaveAccess = startTotalMinutes < schedule.end;
          } else if (mealType === 'LUNCH') {
            // Lunch: acceso solo si empezó antes de las 13:00 PM Y después de las 6:00 AM
            shouldHaveAccess = startTotalMinutes < schedule.end && startTotalMinutes >= (6 * 60);
          } else if (mealType === 'DINNER') {
            // Dinner: acceso solo si empezó antes de las 19:00 PM Y después de las 12:00 PM
            shouldHaveAccess = startTotalMinutes < schedule.end && startTotalMinutes >= (12 * 60);
          } else if (mealType === 'SNACK') {
            // Snack: acceso solo si empezó antes de las 24:00 Y después de las 18:00 PM
            shouldHaveAccess = startTotalMinutes < schedule.end && startTotalMinutes >= (18 * 60);
          }
          
          console.log(`   - ¿Debería tener acceso? ${shouldHaveAccess}`);
          console.log(`   - ¿Tiempo actual (${currentTotalMinutes}) > final comida (${schedule.end})? ${currentTimePassedEnd}`);
          
          if (shouldHaveAccess) {
            passedMeals.push(mealType);
            console.log(`✅ [DEBUG] ${mealType} agregado como faltante (primer día)`);
          } else {
            console.log(`❌ [DEBUG] ${mealType} NO tiene acceso (empezó muy temprano/tarde para esta comida)`);
          }
        } else {
          console.log(`❌ [DEBUG] ${mealType} NO es faltante - Razón:`);
          if (!operationStartedBeforeEnd) {
            console.log(`     - Operación empezó DESPUÉS del final de la comida (${startTotalMinutes} >= ${schedule.end})`);
          }
          if (!currentTimePassedEnd) {
            console.log(`     - Tiempo actual AÚN NO ha pasado el final de la comida (${currentTotalMinutes} <= ${schedule.end})`);
          }
        }
      }
    }
  } else if (todayDate.getTime() > operationStartDate.getTime()) {
    console.log(`🕐 [DEBUG] DÍAS POSTERIORES (${daysFromStart} días después)`);
    
    // ✅ Para días posteriores: TODAS las comidas que ya pasaron hoy
    for (const mealType of mealTypes) {
      const schedule = mealSchedule[mealType];
      if (schedule) {
        const hasPassedToday = currentTotalMinutes > schedule.end;
        console.log(`🍽️ [DEBUG] ${mealType}: actual(${currentTotalMinutes}) > fin(${schedule.end}) = ${hasPassedToday}`);
        
        if (hasPassedToday) {
          passedMeals.push(mealType);
          console.log(`✅ [DEBUG] ${mealType} agregado como faltante (días posteriores)`);
        }
      }
    }
  }

  console.log(`📋 [DEBUG] Comidas que deberían haber pasado HOY: [${passedMeals.join(', ')}]`);

  // ✅ Si no han pasado comidas aún, no hay comidas faltantes
  if (passedMeals.length === 0) {
    console.log(`🚫 [DEBUG] No hay comidas faltantes`);
    return [];
  }

  const result: { workerId: number; workerName: string; missingMeals: string[] }[] = [];
  
  for (const opWorker of operation.workers) {
    // ✅ BUSCAR COMIDAS DESDE EL INICIO DE LA OPERACIÓN, NO SOLO HOY
    const operationStartDay = new Date(operationStartDate.getFullYear(), operationStartDate.getMonth(), operationStartDate.getDate());
    
    const feedings = await this.prisma.workerFeeding.findMany({
      where: {
        id_worker: opWorker.id_worker,
        id_operation: operationId, // ✅ Importante: solo de esta operación
        dateFeeding: { 
          gte: operationStartDay, // ✅ Desde el día que empezó la operación
          lte: endOfDay // ✅ Hasta hoy
        },
      },
    });
    
    const registeredMeals = feedings.map(f => `${f.type}(${f.dateFeeding.toISOString().split('T')[0]})`);
    console.log(`👤 [DEBUG] Trabajador ${opWorker.worker.name} - Comidas registradas desde inicio: [${registeredMeals.join(', ')}]`);
    
    let allMissing: string[] = [];
    
    if (isFirstDay) {
      // ✅ PRIMER DÍA: Solo comidas que ya pasaron HOY
      console.log(`🎯 [DEBUG] Procesando PRIMER DÍA para ${opWorker.worker.name}`);
      
      const todayMissing = passedMeals.filter(type => !feedings.some(f => {
        const feedingDate = new Date(f.dateFeeding);
        const feedingDay = new Date(feedingDate.getFullYear(), feedingDate.getMonth(), feedingDate.getDate());
        return f.type === type && feedingDay.getTime() === todayDate.getTime();
      }));
      
      allMissing = todayMissing;
      console.log(`📊 [DEBUG] Primer día - Solo comidas faltantes de HOY: [${allMissing.join(', ')}]`);
      
    } else {
      // ✅ DÍAS POSTERIORES: Comidas faltantes de hoy + días anteriores
      console.log(`🎯 [DEBUG] Procesando DÍAS POSTERIORES para ${opWorker.worker.name}`);
      
      // Solo las comidas faltantes de hoy
      const todayMissing = passedMeals.filter(type => !feedings.some(f => {
        const feedingDate = new Date(f.dateFeeding);
        const feedingDay = new Date(feedingDate.getFullYear(), feedingDate.getMonth(), feedingDate.getDate());
        return f.type === type && feedingDay.getTime() === todayDate.getTime();
      }));
      
      // También agregar comidas faltantes de días anteriores que nunca se registraron
      const previousDaysMissing: string[] = [];
      for (let d = 0; d < daysFromStart; d++) {
        const checkDate = new Date(operationStartDate);
        checkDate.setDate(checkDate.getDate() + d);
        const checkDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
        
        for (const mealType of mealTypes) {
          const hasThisMeal = feedings.some(f => {
            const feedingDate = new Date(f.dateFeeding);
            const feedingDay = new Date(feedingDate.getFullYear(), feedingDate.getMonth(), feedingDate.getDate());
            return f.type === mealType && feedingDay.getTime() === checkDay.getTime();
          });
          
          if (!hasThisMeal) {
            // Verificar si esta comida debería existir en ese día
            if (d === 0) {
              // Primer día: solo si empezó antes del final de la comida
              const startTotalMinutes = operationStart.getHours() * 60 + operationStart.getMinutes();
              const schedule = mealSchedule[mealType];
              if (schedule && startTotalMinutes < schedule.end) {
                previousDaysMissing.push(mealType);
              }
            } else {
              // Días intermedios: todas las comidas
              previousDaysMissing.push(mealType);
            }
          }
        }
      }
      
      allMissing = [...new Set([...todayMissing, ...previousDaysMissing])];
      console.log(`📊 [DEBUG] Días posteriores - Faltantes HOY: [${todayMissing.join(', ')}]`);
      console.log(`📊 [DEBUG] Días posteriores - Faltantes ANTERIORES: [${previousDaysMissing.join(', ')}]`);
      console.log(`📊 [DEBUG] Días posteriores - TOTAL: [${allMissing.join(', ')}]`);
    }
    
    if (allMissing.length > 0) {
      console.log(`🍽️ [DEBUG] Trabajador ${opWorker.worker.name} - Comidas faltantes TOTAL: [${allMissing.join(', ')}]`);
      
      result.push({
        workerId: opWorker.id_worker,
        workerName: opWorker.worker.name,
        missingMeals: allMissing,
      });
    } else {
      console.log(`✅ [DEBUG] Trabajador ${opWorker.worker.name} - Sin comidas faltantes`);
    }
  }
  
  console.log(`📊 [DEBUG] Total trabajadores con comidas faltantes: ${result.length}`);
  return result;
}
}