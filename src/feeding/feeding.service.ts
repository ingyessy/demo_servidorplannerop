import { Injectable } from '@nestjs/common';
import { CreateFeedingDto } from './dto/create-feeding.dto';
import { UpdateFeedingDto } from './dto/update-feeding.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { FilterWorkerFeedingDto } from './dto/filter-worker-feeding.dto';
import { PaginationFeedingService } from 'src/common/services/pagination/feeding/pagination-feeding.service';

@Injectable()
export class FeedingService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
    private paginationService: PaginationFeedingService,
  ) {}
  async create(createFeedingDto: CreateFeedingDto) {
    try {
      const validation = await this.validation.validateAllIds({
        workerIds: [createFeedingDto.id_worker],
        id_operation: createFeedingDto.id_operation,
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const response = await this.prisma.workerFeeding.create({
        data: {
          ...createFeedingDto,
          id_worker: createFeedingDto.id_worker,
          id_operation: createFeedingDto.id_operation,
        },
      });
      if (!response) {
        return { message: 'Feeding not created', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.workerFeeding.findMany();
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.workerFeeding.findUnique({
        where: {
          id,
        },
      });
      if (!response) {
        return { message: 'Feeding not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

    async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: FilterWorkerFeedingDto,
    activatePaginated: boolean = true,
  ) {
    try {
      
      // Usar el servicio de paginación para feeding
      const paginatedResponse =
        await this.paginationService.paginateWorkerFeeding({
          prisma: this.prisma,
          page,
          limit,
          filters,
          activatePaginated: activatePaginated === false ? false : true,
        });

      // Si no hay resultados, mantener el formato de respuesta de error
      if (paginatedResponse.items.length === 0) {
        return {
          message: 'No worker feeding records found for the requested page',
          status: 404,
          pagination: paginatedResponse.pagination,
          items: [],
          nextPages: [],
        };
      }

      return paginatedResponse;
    } catch (error) {
      console.error('Error finding worker feeding with pagination:', error);
      throw new Error(error.message);
    }
  }

  async findByOperation(id_operation: number) {
    try {
      const validation = await this.validation.validateAllIds({
        id_operation,
      })
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const response = await this.prisma.workerFeeding.findMany({
        where: {
          id_operation,
        },
      });
      if (!response) {
        return { message: 'Feeding not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async update(id: number, updateFeedingDto: UpdateFeedingDto) {
    try {
      const validation = await this.validation.validateAllIds({
        id_operation: updateFeedingDto.id_operation,
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const validate = await this.findOne(id);
      if (validate && 'status' in validate && validate.status === 404) {
        return validate;
      }
      const response = await this.prisma.workerFeeding.update({
        where: {
          id,
        },
        data: {
          ...updateFeedingDto,
          id_worker: updateFeedingDto.id_worker,
          id_operation: updateFeedingDto.id_operation,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }

  async remove(id: number) {
    try {
      const validate = await this.findOne(id);
      if (validate && 'status' in validate && validate.status === 404) {
        return validate;
      }
      const response = await this.prisma.workerFeeding.delete({
        where: {
          id,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
}
