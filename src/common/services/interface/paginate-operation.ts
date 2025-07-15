export interface PaginationInfo {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalInProgress?: number;
  totalPending?: number;
  totalCompleted?: number;
  totalCanceled?: number;
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