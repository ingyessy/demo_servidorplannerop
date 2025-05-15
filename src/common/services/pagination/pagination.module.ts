import { Module } from '@nestjs/common';
import { PaginationService } from './pagination.service';
import { PaginateOperationService } from './operation/paginate-operation.service';
import { PaginationCalledService } from './called-attention/pagination-called.service';

@Module({
  providers: [
    PaginationService, 
    PaginateOperationService,
    PaginationCalledService
  ],
  exports: [
    PaginationService, 
    PaginateOperationService,
    PaginationCalledService
  ],
})
export class PaginationModule {}