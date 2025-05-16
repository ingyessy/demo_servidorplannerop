import { Module } from '@nestjs/common';
import { PaginationService } from './pagination.service';
import { PaginateOperationService } from './operation/paginate-operation.service';
import { PaginationCalledService } from './called-attention/pagination-called.service';
import { PaginationFeedingService } from './feeding/pagination-feeding.service';

@Module({
  providers: [
    PaginationService, 
    PaginateOperationService,
    PaginationCalledService,
    PaginationFeedingService
  ],
  exports: [
    PaginationService, 
    PaginateOperationService,
    PaginationCalledService,
    PaginationFeedingService
  ],
})
export class PaginationModule {}