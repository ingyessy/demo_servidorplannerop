import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatusActivation, StatusOperation, Prisma } from '@prisma/client';
import { OperationTransformerService } from './operation-transformer.service';
import { PaginationService } from 'src/common/services/pagination.service';
import { OperationFilterDto } from '../dto/fliter-operation.dto';

/**
 * Servicio para buscar operaciones
 */
@Injectable()
export class OperationFinderService {
  // Configuraciones de consulta reutilizables
  private readonly defaultInclude = {
    client: {
      select: { name: true },
    },
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
        dateEnd: true,
        id_group: true,
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    inChargeOperation: {
      select: {
        id_user: true,
        id_operation: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  };

  constructor(
    private prisma: PrismaService,
    private transformer: OperationTransformerService,
    private paginationService: PaginationService,
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

      return response.map((op) =>
        this.transformer.transformOperationResponse(op),
      );
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
   * Encuentra operaciones asociadas a un trabajador específico
   * @param id_worker - ID del trabajador para buscar operaciones
   * @returns Lista de operaciones asociadas al trabajador o mensaje de error
   */
  async findByWorker(id_worker: number) {
    try {
      const response = await this.prisma.operation.findMany({
        where: {
          workers: {
            some: {
              id_worker,
            },
          },
        },
        include: this.defaultInclude,
      });

      if (response.length === 0) {
        return { message: 'No operations found for this worker', status: 404 };
      }

      return response.map((op) =>
        this.transformer.transformOperationResponse(op),
      );
    } catch (error) {
      console.error(`Error finding operations for worker ${id_worker}:`, error);
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
      // Verificar si los estados son válidos y si es en estado completadas
      const isCompletedOnly = statuses.length === 1 && 
        statuses[0] === StatusOperation.COMPLETED;
      
      // Si solo se busca COMPLETED, no se permiten otros estados
      const queryConfig = {
        where: {
          status: {
            in: statuses,
          },
        },
        include: this.defaultInclude,
        orderBy: isCompletedOnly 
          ? { dateStart: Prisma.SortOrder.desc }  // Most recent first for COMPLETED
          : { dateStart: Prisma.SortOrder.asc },  // Keep original order for other statuses
      };
      
      // Limitar a 30 resultados si solo se busca COMPLETED
      if (isCompletedOnly) {
        queryConfig['take'] = 30;
      }
      
      const response = await this.prisma.operation.findMany(queryConfig);
  
      if (response.length === 0) {
        return {
          message: `No operations found with statuses: ${statuses.join(', ')}`,
          status: 404,
        };
      }
  
      // Transformar la respuesta
      const transformedResponse = response.map((operation) =>
        this.transformer.transformOperationResponse(operation),
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

      return response.map((op) =>
        this.transformer.transformOperationResponse(op),
      );
    } catch (error) {
      console.error('Error finding operations by date range:', error);
      throw new Error(error.message);
    }
  }
  /**
   * Obtiene operaciones con paginación y filtros opcionales
   * @param page Número de página (por defecto: 1)
   * @param limit Elementos por página (por defecto: 10, máximo: 50)
   * @param filters Filtros opcionales para las operaciones
   * @returns Respuesta paginada con los datos actuales y prefetch de las siguientes 2 páginas
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: OperationFilterDto,
    activatePaginated: boolean = true,
  ) {
    try {
      // Construir el objeto de filtros para la consulta
      const whereClause: any = {};
  
      // Aplicar filtros si están definidos
      if (filters?.status && filters.status.length > 0) {
        whereClause.status = { in: filters.status };
      }
  
      if (filters?.dateStart) {
        whereClause.dateStart = { gte: filters.dateStart };
      }
  
      if (filters?.dateEnd) {
        whereClause.dateEnd = { lte: filters.dateEnd };
      }
  
      if (filters?.jobAreaId) {
        whereClause.jobArea = {
          id: filters.jobAreaId,
        };
      }
  
      if (filters?.userId) {
        whereClause.id_user = filters.userId;
      }
  
      if (filters?.inChargedId) {
        whereClause.inChargeOperation = {
          some: {
            id_user: Array.isArray(filters.inChargedId)
              ? { in: filters.inChargedId }
              : filters.inChargedId,
          },
        };
      }
  
      if (filters?.search) {
        whereClause.OR = [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { task: { name: { contains: filters.search, mode: 'insensitive' } } },
          {
            jobArea: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
        ];
      }
  
      // Configuración base de la consulta
      const queryConfig: any = {
        where: whereClause,
        include: this.defaultInclude,
        orderBy: [
          { status: Prisma.SortOrder.asc },
          { dateStart: Prisma.SortOrder.desc },
        ],
      };
  
      // Obtener conteos totales
      const totalItems = await this.prisma.operation.count({
        where: whereClause,
      });
  
      const colombiaTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }),
      );
  
      const whereClauseDate = {
        dateStart: colombiaTime,
      };
  
      // Obtener estadísticas
      const [totalInProgress, totalPending, totalCompleted, totalCanceled] = await Promise.all([
        this.prisma.operation.count({
          where: {
            ...whereClauseDate,
            status: StatusOperation.INPROGRESS,
          },
        }),
        this.prisma.operation.count({
          where: {
            ...whereClauseDate,
            status: StatusOperation.PENDING,
          },
        }),
        this.prisma.operation.count({
          where: {
            ...whereClauseDate,
            status: StatusOperation.COMPLETED,
          },
        }),
        this.prisma.operation.count({
          where: {
            ...whereClauseDate,
            status: StatusOperation.CANCELED,
          },
        }),
      ]);

      if (activatePaginated === false) {
        const allItems = await this.prisma.operation.findMany(queryConfig);
        const transformedItems = allItems.map(operation => 
          this.transformer.transformOperationResponse(operation)
        );
  
        return {
          items: transformedItems,
          pagination: {
            totalItems,
            totalInProgress,
            totalPending,
            totalCompleted,
            totalCanceled,
            currentPage: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            itemsPerPage: totalItems
          },
          nextPages: []
        };
      }
  
      // Si hay paginación, aplicar skip y take
      const pageNumber = Math.max(1, page);
      const itemsPerPage = Math.min(50, Math.max(1, limit));
      const skip = (pageNumber - 1) * itemsPerPage;
  
      queryConfig.skip = skip;
      queryConfig.take = itemsPerPage;
  
      // Obtener items paginados
      const paginatedItems = await this.prisma.operation.findMany(queryConfig);
      const transformedItems = paginatedItems.map(operation => 
        this.transformer.transformOperationResponse(operation)
      );
  
      // Si no hay resultados, devolver respuesta vacía
      if (transformedItems.length === 0) {
        return {
          items: [],
          pagination: {
            totalItems: 0,
            totalInProgress,
            totalPending,
            totalCompleted,
            totalCanceled,
            currentPage: pageNumber,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
            itemsPerPage
          },
          nextPages: []
        };
      }
  
      // Procesar resultados paginados
      const paginatedResults = this.paginationService.processPaginatedResults(
        transformedItems,
        pageNumber,
        itemsPerPage,
        totalItems,
      );
  
      // Retornar resultados con estadísticas
      return {
        ...paginatedResults,
        pagination: {
          ...paginatedResults.pagination,
          totalInProgress,
          totalPending,
          totalCompleted,
          totalCanceled,
        },
      };
  
    } catch (error) {
      console.error('Error finding operations:', error);
      throw new Error(`Error finding operations: ${error.message}`);
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

      return response.map((op) =>
        this.transformer.transformOperationResponse(op),
      );
    } catch (error) {
      console.error(`Error finding operations for user ${id_user}:`, error);
      throw new Error(error.message);
    }
  }
}
