import { Injectable } from '@nestjs/common';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { FilterCalledAttentionDto } from './dto/filter-called-attention';
import { PaginationCalledService } from 'src/common/services/pagination/called-attention/pagination-called.service';
/**
 * Servicio para gestionar las atenciones llamadas
 * @class CalledAttentionService
 * @category Service
 */
@Injectable()
export class CalledAttentionService {
  /**
   *  Constructor del servicio
   * @param prisma
   * @param validation
   */
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
    private paginateService: PaginationCalledService,
  ) {}

  /**
   * Crear una atencion llamada
   * @param createCalledAttentionDto datos de la atencion llamada a crear
   * @returns respuesta de la creacion de la atencion llamada
   */
  async create(
    createCalledAttentionDto: CreateCalledAttentionDto,
    id_site?: number,
  ) {
    try {
      if (createCalledAttentionDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }
      const validation = await this.validation.validateAllIds({
        workerIds: [createCalledAttentionDto.id_worker],
      });
      const workerValidation = validation?.existingWorkers?.[0];
      if (id_site != undefined) {
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to create attention for this worker',
            status: 409,
          };
        }
      }
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
  
      const response = await this.prisma.calledAttention.create({
        data: {
          ...createCalledAttentionDto,
          id_user: createCalledAttentionDto.id_user,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Obtener todas las atenciones llamadas de trabajadores activos de los últimos 3 meses
   * @returns respuesta de la busqueda de todas las atenciones llamadas activas recientes
   */
  async findAll(id_site?: number) {
    try {
      // Calcular la fecha de hace 3 meses
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 40);

      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 1);
      const response = await this.prisma.calledAttention.findMany({
        where: {
          // Filtrar por estado del trabajador
          worker: {
            status: {
              notIn: ['UNAVALIABLE'],
            },
            id_site: id_site,
          },
          // Filtrar por fecha (mes actual)
          createAt: {
            gte: threeMonthsAgo,
            lte: maxDate,
          },
        },
        include: {
          worker: {
            select: {
              dni: true,
              name: true,
              id_site: true,
            },
          },
        },
        orderBy: {
          createAt: 'desc', // Ordenar por fecha de creación descendente (más reciente primero)
        },
      });

      if (response.length === 0) {
        return {
          message: 'No active called attentions found in the last 3 months',
          status: 404,
        };
      }

      return response;
    } catch (error) {
      console.error('Error finding called attentions:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Obtener una atencion llamada por ID
   * @param id ID de la atencion llamada a buscar
   * @returns respuesta de la busqueda de la atencion llamada
   */
  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.calledAttention.findUnique({
        where: {
          id,
          worker: {
            id_site: id_site,
          },
        },
      });
      if (!response) {
        return { message: 'Called Attention not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Obtener una atencion llamada por ID sin validacion de existencia
   * @param id ID de la atencion llamada a buscar
   * @returns respuesta de la busqueda de la atencion llamada
   */
  async findOneByIdWorker(id: number, id_site?: number) {
    try {
      const response = await this.prisma.calledAttention.findMany({
        where: {
          id_worker: id,
          worker: {
            id_site: id_site,
          },
        },
      });
      if (!response || response.length === 0) {
        return { message: 'Called Attention not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Obtener atenciones llamadas con paginación y prefetch de páginas adicionales
   * @param page Número de página (por defecto: 1)
   * @param limit Elementos por página (por defecto: 10, máximo: 50)
   * @returns Respuesta paginada con los datos actuales y prefetch de las siguientes 2 páginas
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: FilterCalledAttentionDto,
    activatePaginated: boolean = true,
  ) {
    try {
      // Usar el servicio de paginación para llamadas de atención
      const paginatedResponse =
        await this.paginateService.paginateCalledAttentions({
          prisma: this.prisma,
          page,
          limit,
          filters,
          activatePaginated,
        });

      // Si no hay resultados, mantener el formato de respuesta de error
      if (paginatedResponse.items.length === 0) {
        return {
          message: 'No called attentions found for the requested page',
          status: 404,
          pagination: paginatedResponse.pagination,
          items: [],
          nextPages: [],
        };
      }

      return paginatedResponse;
    } catch (error) {
      console.error('Error finding called attentions with pagination:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Actualizar una atencion llamada
   * @param id ID de la atencion llamada a actualizar
   * @param updateCalledAttentionDto datos de la atencion llamada a actualizar
   * @returns respuesta de la actualizacion de la atencion llamada
   */
  async update(
    id: number,
    updateCalledAttentionDto: UpdateCalledAttentionDto,
    id_site?: number,
  ) {
    try {
      const validationCalled = await this.findOne(id);
      if (validationCalled['status'] === 404) {
        return validationCalled;
      }
      if (id_site != undefined) {
        const id_worker = validationCalled['id_worker'];
        const validateWorker = await this.validation.validateAllIds({
          workerIds: [id_worker],
        });
        const wokerValidation = validateWorker?.existingWorkers?.[0];
        if (wokerValidation && wokerValidation.id_site != id_site) {
          return {
            message: 'Not authorized to update attention',
            status: 409,
          };
        }
      }
      if (updateCalledAttentionDto.id_worker === undefined) {
        return { message: 'Worker ID is required', status: 400 };
      }
      const validadionGlobal = await this.validation.validateAllIds({
        workerIds: [updateCalledAttentionDto.id_worker],
      });

      if (
        validadionGlobal &&
        'status' in validadionGlobal &&
        validadionGlobal.status === 404
      ) {
        return validadionGlobal;
      }

      const workerValidation = validadionGlobal?.existingWorkers?.[0];
      if (id_site != undefined) {
        if (workerValidation && workerValidation.id_site != id_site) {
          return {
            message: 'Not authorized to create attention for this worker',
            status: 409,
          };
        }
      }
      const response = await this.prisma.calledAttention.update({
        where: { id },
        data: updateCalledAttentionDto,
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Eliminar una atencion llamada
   * @param id ID de la atencion llamada a eliminar
   * @returns respuesta de la eliminacion de la atencion llamada
   * @throws Error
   */
  async remove(id: number, id_site?: number) {
    try {
      const validationCalled = await this.findOne(id);
      if (validationCalled['status'] === 404) {
        return validationCalled;
      }
      if (id_site != undefined) {
        const id_worker = validationCalled['id_worker'];
        const validateWorker = await this.validation.validateAllIds({
          workerIds: [id_worker],
        });
        const wokerValidation = validateWorker?.existingWorkers?.[0];
        if (wokerValidation && wokerValidation.id_site != id_site) {
          return {
            message: 'Not authorized to remove attention',
            status: 409,
          };
        }
      }
      const response = await this.prisma.calledAttention.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
