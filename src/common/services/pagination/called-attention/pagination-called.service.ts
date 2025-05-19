import { Injectable } from '@nestjs/common';
import { PaginatedResponse } from '../../interface/paginate-operation';
import { PaginationService } from '../pagination.service';
import { FilterCalledAttentionDto } from 'src/called-attention/dto/filter-called-attention'; 

/**
 * Servicio específico para la paginación de llamadas de atención
 */
@Injectable()
export class PaginationCalledService {
  constructor(private readonly paginationService: PaginationService) {}

  /**
   * Pagina las llamadas de atención con opciones específicas
   */
  async paginateCalledAttentions<T>(
    options: {
      prisma: any;
      page?: number;
      limit?: number;
      filters?: FilterCalledAttentionDto;
      activatePaginated?: boolean;
    }
  ): Promise<PaginatedResponse<T>> {
    try {
      const {
        prisma,
        page = 1,
        limit = 10,
        filters,
        activatePaginated = true,
      } = options;

      // Extraer activatePaginated del filtro si está definido
      const finalActivatePaginated = 
        filters?.activatePaginated !== undefined ? 
        filters.activatePaginated : 
        activatePaginated;

      // Usar el servicio genérico de paginación
      return await this.paginationService.paginateEntity<T>({
        prisma,
        entity: 'calledAttention',
        page,
        limit,
        filters,
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
        activatePaginated: finalActivatePaginated,
        buildWhereClause: filters => this.buildCalledAttentionWhereClause(filters),
      });
    } catch (error) {
      console.error('Error paginating called attentions:', error);
      throw new Error(`Error paginating called attentions: ${error.message}`);
    }
  }

  /**
   * Construye la cláusula where para las llamadas de atención
   */
  private buildCalledAttentionWhereClause(filters?: FilterCalledAttentionDto): any {
    const whereClause: any = {};
    
    if (!filters) return whereClause;

    // Filtro por tipo de llamado de atención
    if (filters.type) {
      whereClause.type = filters.type;
    }

    // Filtro por fecha de inicio
    if (filters.startDate) {
      whereClause.createAt = { 
        ...whereClause.createAt,
        gte: new Date(filters.startDate) 
      };
    }

    // Filtro por fecha de fin
    if (filters.endDate) {
      whereClause.createAt = { 
        ...whereClause.createAt,
        lte: new Date(filters.endDate) 
      };
    }

    // Filtro de búsqueda por DNI o nombre del trabajador
    if (filters.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.trim();
      
      // Buscar tanto en DNI como en nombre del trabajador
      whereClause.OR = [
        { worker: { dni: { contains: searchTerm, mode: 'insensitive' } } },
        { worker: { name: { contains: searchTerm, mode: 'insensitive' } } }
      ];
    }

    return whereClause;
  }
}