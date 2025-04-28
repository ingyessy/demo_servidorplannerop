import { Injectable } from '@nestjs/common';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
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
  ) {}

  /**
   * Crear una atencion llamada
   * @param createCalledAttentionDto datos de la atencion llamada a crear
   * @returns respuesta de la creacion de la atencion llamada
   */
  async create(createCalledAttentionDto: CreateCalledAttentionDto) {
    try {
      if (createCalledAttentionDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }

      const validation = await this.validation.validateAllIds({
        workerIds: [createCalledAttentionDto.id_worker],
      });
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
  async findAll() {
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
  async findOne(id: number) {
    try {
      const response = await this.prisma.calledAttention.findUnique({
        where: {
          id,
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
  async findOneByIdWorker(id: number) {
    try {
      const response = await this.prisma.calledAttention.findMany({
        where: {
          id_worker: id,
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
   * Obtener atenciones llamadas con paginación y prefetch de páginas adicionales
   * @param page Número de página (por defecto: 1)
   * @param limit Elementos por página (por defecto: 10, máximo: 50)
   * @returns Respuesta paginada con los datos actuales y prefetch de las siguientes 2 páginas
   */
  async findAllPaginated(page: number = 1, limit: number = 10) {
    try {
      // Validar y ajustar los parámetros de paginación
      const pageNumber = Math.max(1, page); // Asegura que la página sea al menos 1
      const itemsPerPage = Math.min(50, Math.max(1, limit)); // Limita entre 1 y 50 elementos
      const skip = (pageNumber - 1) * itemsPerPage;

      // Obtener el total de registros para el cálculo de páginas
      const totalItems = await this.prisma.calledAttention.count();

      // Calcular el total de páginas
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // Determinar cuántas páginas adicionales podemos cargar (máximo 2)
      const additionalPagesToFetch = Math.min(2, totalPages - pageNumber);

      // Calcular el total de elementos a recuperar (página actual + páginas adicionales)
      const totalItemsToFetch = itemsPerPage * (1 + additionalPagesToFetch);

      // Obtener los elementos de la página actual y las siguientes (si hay)
      const allItems = await this.prisma.calledAttention.findMany({
        include: {
          worker: {
            select: {
              dni: true,
              name: true,
              status: true,
            },
          },
          user: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          createAt: 'desc',
        },
        skip: skip,
        take: totalItemsToFetch,
      });

      // Si no hay elementos
      if (allItems.length === 0) {
        return {
          message: 'No called attentions found for the requested page',
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

      // Separar los elementos entre la página actual y las páginas siguientes
      const currentPageItems = allItems.slice(0, itemsPerPage);

      // Organizar los elementos de las páginas adicionales
      type PageItem = {
        pageNumber: number;
        items: typeof allItems;
      };
      const nextPagesItems: PageItem[] = [];
      for (let i = 0; i < additionalPagesToFetch; i++) {
        const startIndex = (i + 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = allItems.slice(startIndex, endIndex);

        if (pageItems.length > 0) {
          nextPagesItems.push({
            pageNumber: pageNumber + i + 1,
            items: pageItems,
          });
        }
      }

      // Construir la respuesta paginada
      return {
        pagination: {
          totalItems,
          itemsPerPage,
          currentPage: pageNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
        items: currentPageItems,
        nextPages: nextPagesItems,
      };
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
  async update(id: number, updateCalledAttentionDto: UpdateCalledAttentionDto) {
    try {
      const validationCalled = await this.findOne(id);
      if (validationCalled['status'] === 404) {
        return validationCalled;
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
  async remove(id: number) {
    try {
      const validadionCalled = await this.findOne(id);
      if (validadionCalled['status'] === 404) {
        return validadionCalled;
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
