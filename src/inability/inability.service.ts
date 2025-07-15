import { Injectable } from '@nestjs/common';
import { CreateInabilityDto } from './dto/create-inability.dto';
import { UpdateInabilityDto } from './dto/update-inability.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { FilterInabilityDto } from './dto/filter-inability';

@Injectable()
export class InabilityService {
  constructor(
    private prisma: PrismaService,
    private validate: ValidationService,
  ) {}

  async create(createInabilityDto: CreateInabilityDto) {
    try {
      const validation = await this.validate.validateAllIds({
        workerIds: [createInabilityDto.id_worker],
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const response = await this.prisma.inability.create({
        data: { ...createInabilityDto },
      });

      return response;
    } catch (error) {
      throw new Error(`Error creating inability: ${error}`);
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.inability.findMany();
      if (!response || response.length === 0) {
        return { status: 404, message: 'No inabilities found' };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding all inabilities: ${error}`);
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.inability.findUnique({
        where: { id },
      });
      if (!response) {
        return { status: 404, message: `Inability with id ${id} not found` };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding inability with id ${id}: ${error}`);
    }
  }

  async findByFilters(filters: FilterInabilityDto) {
    try {
      const validation = await this.validate.validateAllIds({
        workerIds: filters.id_worker ? [filters.id_worker] : [],
      })
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const where: any = {};

      if (filters) {
        if (filters.id_worker) {
          where.id_worker = filters.id_worker;
        }
        if (filters.type) {
          where.type = filters.type;
        }
        if (filters.cause) {
          where.cause = filters.cause;
        }

        if (filters.dateDisableEnd || filters.dateDisableStart) {
         if(filters.dateDisableEnd){
          where.dateDisableEnd = filters.dateDisableEnd;
         }
          if(filters.dateDisableStart){
            where.dateDisableStart = filters.dateDisableStart;
          }
        }
      }
      const response = await this.prisma.inability.findMany({
        where,
        include: {
          worker: {
            select: {
              name: true,
              dni: true,
            },
          },
        },
        orderBy: {
          dateDisableStart: 'desc',
        },
      });

      if (!response || response.length === 0) {
        return { status: 404, message: 'No inabilities found' };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding inabilities by filters: ${error}`);
    }
  }

  async update(id: number, updateInabilityDto: UpdateInabilityDto) {
    try {
      const validation = await this.findOne(id);
      if (validation['status'] != undefined) {
        return validation;
      }
      const response = await this.prisma.inability.update({
        where: { id },
        data: { ...updateInabilityDto },
      });
      return response;
    } catch (error) {
      throw new Error(`Error updating inability with id ${id}: ${error}`);
    }
  }

  async remove(id: number) {
    try {
      const validation = await this.findOne(id);
      if (validation['status'] != undefined) {
        return validation;
      }
      const response = await this.prisma.inability.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error(`Error removing inability with id ${id}: ${error}`);
    }
  }
}
