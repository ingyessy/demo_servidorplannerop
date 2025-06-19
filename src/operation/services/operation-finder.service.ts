import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, StatusOperation } from '@prisma/client';
import { OperationTransformerService } from './operation-transformer.service';
import { OperationFilterDto } from '../dto/fliter-operation.dto';
import { PaginateOperationService } from 'src/common/services/pagination/operation/paginate-operation.service';

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
    clientProgramming: {
      select: {
        service: true,
      },
    },
    Site: {
      select: {
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
        task: {
          // Cambiar 'task' por 'Task' (con T mayúscula)
          select: {
            id: true,
            name: true,
          },
        },
         subTask: true,
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
    private paginationService: PaginateOperationService,
  ) {}

  /**
   * Obtiene todas las operaciones con información detallada
   * @returns Lista de operaciones con relaciones incluidas
   */
  async findAll(id_site?: number, id_subsite?: number) {
    try {
      console.log(
        `Getting all operations for Site: ${id_site}, Subsite: ${id_subsite}`,
      );
      const response = await this.prisma.operation.findMany({
        where: {
          id_site,
          id_subsite,
        },
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
  async findOne(id: number, id_site?: number, id_subsite?: number) {
    try {
      const response = await this.prisma.operation.findUnique({
        where: { id, id_site, id_subsite },
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
  async findByStatuses(
    statuses: StatusOperation[],
    id_site?: number,
    id_subsite?: number,
  ) {
    try {
      // Verificar si los estados son válidos y si es en estado completadas
      const isCompletedOnly =
        statuses.length === 1 && statuses[0] === StatusOperation.COMPLETED;

      // Si solo se busca COMPLETED, no se permiten otros estados
      const queryConfig = {
        where: {
          status: {
            in: statuses,
          },
          id_site: id_site,
          id_subsite: id_subsite,
        },
        include: this.defaultInclude,
        orderBy: isCompletedOnly
          ? { dateStart: Prisma.SortOrder.desc } // Most recent first for COMPLETED
          : { dateStart: Prisma.SortOrder.asc }, // Keep original order for other statuses
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
  async findByDateRange(
    start: Date,
    end: Date,
    id_site?: number,
    id_subsite?: number,
  ) {
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
            { id_site: id_site, id_subsite: id_subsite },
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
      // Usar el servicio de paginación mejorado
      return await this.paginationService.paginateOperations({
        prisma: this.prisma,
        page,
        limit,
        filters,
        activatePaginated,
        defaultInclude: this.defaultInclude,
        transformer: this.transformer,
      });
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
  async findByUser(id_user: number, id_site?: number, id_subsite?: number) {
    try {
      const response = await this.prisma.operation.findMany({
        where: { id_user, id_site, id_subsite },
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
