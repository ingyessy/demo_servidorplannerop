import { Injectable } from '@nestjs/common';

@Injectable()
export class PaginationService {
  /**
   * Procesa los resultados de una consulta y los organiza en formato paginado con prefetch
   * @param items Elementos a paginar
   * @param page Número de página actual
   * @param limit Límite de elementos por página
   * @param totalItems Total de elementos en la base de datos
   * @returns Resultados paginados con prefetch de páginas adicionales
   */
  processPaginatedResults<T>(
    items: T[],
    page: number,
    limit: number,
    totalItems: number
  ): PaginatedResponse<T> {
    const pageNumber = Math.max(1, page);
    const itemsPerPage = Math.min(50, Math.max(1, limit));
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Si no hay elementos
    if (items.length === 0) {
      return {
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
    
    // Separar los elementos entre la página actual y las siguientes
    const currentPageItems = items.slice(0, itemsPerPage);
    
    // Organizar las páginas adicionales
    const nextPagesItems: PageData<T>[] = [];
    
    for (let i = 0; i < Math.min(2, totalPages - pageNumber); i++) {
      const startIndex = (i + 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageItems = items.slice(startIndex, endIndex);
      
      if (pageItems.length > 0) {
        nextPagesItems.push({
          pageNumber: pageNumber + i + 1,
          items: pageItems,
        });
      }
    }
    
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
  }
}

// Tipos para las respuestas paginadas
export interface PaginationInfo {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PageData<T> {
  pageNumber: number;
  items: T[];
}

export interface PaginatedResponse<T> {
  pagination: PaginationInfo;
  items: T[];
  nextPages: PageData<T>[];
}