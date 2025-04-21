import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatusOperation } from '@prisma/client';
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
          status: 404,
        };
      }

      // Transformar operaciones - workerGroups ya está incluido en la transformación
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
  ) {
    try {
      // Validar y ajustar los parámetros de paginación
      const pageNumber = Math.max(1, page);
      const itemsPerPage = Math.min(50, Math.max(1, limit));
      const skip = (pageNumber - 1) * itemsPerPage;

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
        whereClause.id_jobArea = filters.jobAreaId;
      }

      if (filters?.userId) {
        whereClause.id_user = filters.userId;
      }

      if (filters?.inChargedId) {
        whereClause.inChargeOperation = {
          some: {
            id_user: Array.isArray(filters.inChargedId)
              ? { in: filters.inChargedId }
              : filters.inChargedId
          }
        };
      }
  

      // Filtro de búsqueda por texto - buscar en campos relevantes
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

      // Obtener el total de registros para el cálculo de páginas
      const totalItems = await this.prisma.operation.count({
        where: whereClause,
      });

      // Calcular el total de páginas
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // Determinar cuántas páginas adicionales podemos cargar (máximo 2)
      const additionalPagesToFetch = Math.min(2, totalPages - pageNumber);

      // Calcular el total de elementos a recuperar (página actual + páginas adicionales)
      const totalItemsToFetch = itemsPerPage * (1 + additionalPagesToFetch);

      // Obtener los elementos de la página actual y las siguientes (si hay)
      const allItems = await this.prisma.operation.findMany({
        where: whereClause,
        include: this.defaultInclude,
        orderBy: [
          { status: 'asc' }, // Primero por estado
          { dateStart: 'desc' }, // Luego por fecha más reciente
        ],
        skip: skip,
        take: totalItemsToFetch,
      });

      // Transformar todas las operaciones
      const transformedItems = allItems.map((operation) =>
        this.transformer.transformOperationResponse(operation),
      );

      // Si no hay elementos, devolver respuesta vacía
      if (transformedItems.length === 0) {
        return {
          message: 'No operations found for the requested criteria',
          status: 404,
          pagination: {
            totalItems: 0,
            itemsPerPage,
            currentPage: pageNumber,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          items: [],
          nextPages: [],
        };
      }

      // Usar el servicio de paginación para organizar los resultados
      return this.paginationService.processPaginatedResults(
        transformedItems,
        pageNumber,
        itemsPerPage,
        totalItems,
      );
    } catch (error) {
      console.error('Error finding operations with pagination:', error);
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

      return response.map((op) =>
        this.transformer.transformOperationResponse(op),
      );
    } catch (error) {
      console.error(`Error finding operations for user ${id_user}:`, error);
      throw new Error(error.message);
    }
  }
}
