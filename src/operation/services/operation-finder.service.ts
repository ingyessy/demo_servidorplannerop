import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatusOperation } from '@prisma/client';
import { OperationTransformerService } from './operation-transformer.service';

/**
 * Servicio para buscar operaciones
 */
@Injectable()
export class OperationFinderService {
  // Configuraciones de consulta reutilizables
  private readonly defaultInclude = {
    jobArea: {
      select: {
        id: true,
        name: true,
      },
    },
    task: {
      select: {
        id: true,
        name: true,
      },
    },
    workers: {
      select: {
        id: true,
        id_worker: true,
        timeStart: true,
        timeEnd: true,
        dateStart: true,
        dateEnd: true
      },
    },
    inChargeOperation: {
      select: {
        id_user: true,
      },
    },
  };

  constructor(
    private prisma: PrismaService,
    private transformer: OperationTransformerService,
  ) {}

  /**
   * Obtiene todas las operaciones con información detallada
   * @returns Lista de operaciones con relaciones incluidas
   */
  async findAll() {
    try {
      const response = await this.prisma.operation.findMany({
        include: this.defaultInclude,
      });

      return response.map(op => this.transformer.transformOperationResponse(op));
    } catch (error) {
      console.error('Error getting all operations:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Busca una operación por su ID
   * @param id - ID de la operación a buscar
   * @returns Operación encontrada o mensaje de error
   */
  async findOne(id: number) {
    try {
      const response = await this.prisma.operation.findUnique({
        where: { id },
        include: this.defaultInclude,
      });
      
      if (!response) {
        return { message: 'Operation not found', status: 404 };
      }
      
      return this.transformer.transformOperationResponse(response);
    } catch (error) {
      console.error(`Error finding operation with ID ${id}:`, error);
      throw new Error(error.message);
    }
  }

  /**
   * Encuentra todas las operaciones con los estados especificados
   * @param statuses - Estados para filtrar las operaciones
   * @returns Lista de operaciones filtradas o mensaje de error
   */
  async findByStatuses(statuses: StatusOperation[]) {
    try {
      const response = await this.prisma.operation.findMany({
        where: {
          status: {
            in: statuses,
          },
        },
        include: this.defaultInclude,
        orderBy: {
          dateStart: 'asc', // Ordenar por fecha de inicio ascendente
        },
      });

      if (response.length === 0) {
        return { 
          message: `No operations found with statuses: ${statuses.join(', ')}`, 
          status: 404 
        };
      }

           // Transformar operaciones - workerGroups ya está incluido en la transformación
           const transformedResponse = response.map(operation => 
            this.transformer.transformOperationResponse(operation)
          );
    
          return transformedResponse;
    } catch (error) {
      console.error('Error finding operations by status:', error);
      throw new Error(`Error finding operations by status: ${error.message}`);
    }
  }

  /**
   * Busca operaciones por rango de fechas
   * @param start Fecha de inicio
   * @param end Fecha de fin
   * @returns Resultado de la búsqueda
   */
  async findByDateRange(start: Date, end: Date) {
    try {
      const response = await this.prisma.operation.findMany({
        where: {
          AND: [
            {
              dateStart: {
                gte: start,
              },
            },
            {
              dateEnd: {
                lte: end,
              },
            },
          ],
        },
        include: this.defaultInclude,
      });
      
      if (response.length === 0) {
        return { message: 'No operations found in this range', status: 404 };
      }
      
      return response.map(op => this.transformer.transformOperationResponse(op));
    } catch (error) {
      console.error('Error finding operations by date range:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Encuentra operaciones asociadas a un usuario específico
   * @param id_user ID del usuario para buscar operaciones
   * @returns Lista de operaciones asociadas al usuario o mensaje de error
   */
  async findByUser(id_user: number) {
    try {
      const response = await this.prisma.operation.findMany({
        where: { id_user },
        include: this.defaultInclude,
      });
      
      if (response.length === 0) {
        return { message: 'No operations found for this user', status: 404 };
      }
      
      return response.map(op => this.transformer.transformOperationResponse(op));
    } catch (error) {
      console.error(`Error finding operations for user ${id_user}:`, error);
      throw new Error(error.message);
    }
  }
}