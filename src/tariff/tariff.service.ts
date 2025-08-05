import { Injectable } from '@nestjs/common';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

@Injectable()
export class TariffService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
  ) {}

  async create(createTariffDto: CreateTariffDto) {
    try {
      const validateIds = await this.validation.validateAllIds({
        id_subtask: createTariffDto.id_subtask,
        id_costCenter: createTariffDto.id_costCenter,
        id_unidOfMeasure: createTariffDto.id_unidOfMeasure,
      });
      if (
        validateIds &&
        'status' in validateIds &&
        validateIds.status === 404
      ) {
        return validateIds;
      }
      if (validateIds.subtask.code) {
        createTariffDto.code = validateIds.subtask.code;
      }
      const response = await this.prisma.tariff.create({
        data: {
          ...createTariffDto,
        },
      });
      return response;
    } catch (error) {
      console.error('Error creating tariff:', error);
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;
        return {
          message: `Cost center with ${fieldName} '${createTariffDto[fieldName]}' already exists`,
          status: 409,
        };
      } else if (error.code === 'P2003') {
        return {
          message:
            'Invalid foreign key reference. Please check the related entities.',
          status: 400,
        };
      }
      throw new Error('Error creating tariff');
    }
  }

  async findAll(id_subsite: number) {
    try {
      const response = await this.prisma.tariff.findMany({
        where: {
          costCenter: {
            id_subsite,
          },
        },
        include: {
          subTask: true,
          costCenter: true,
          unitOfMeasure: true,
        },
      });
      if (!response || response.length === 0) {
        return { status: 404, message: 'No tariffs found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching tariffs');
    }
  }

  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.tariff.findUnique({
        where: { id, costCenter: { subSite: { id_site } } },
        include: {
          subTask: true,
          costCenter: true,
          unitOfMeasure: true,
        },
      });
      if (!response) {
        return { status: 404, message: 'Tariff not found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching tariff');
    }
  }

  async update(id: number, updateTariffDto: UpdateTariffDto, id_site?: number) {
    try {
      const validateId = await this.findOne(id, id_site);
      if (validateId['status'] === 404) {
        return validateId;
      }
      const dataToUpdate: any = {...updateTariffDto };
      if(updateTariffDto.alternative_paid_service === 'NO'){
        dataToUpdate.id_facturation_unit = null;
      }
      
      const response = await this.prisma.tariff.update({
        where: { id },
        data: {
          ...dataToUpdate
        },
      });
      return response;
    } catch (error) {
      console.error('Error updating tariff:', error);
      throw new Error('Error updating tariff');
    }
  }

  async remove(id: number, id_site?: number) {
    try {
      const validateID = await this.findOne(id, id_site);
      if (validateID['status'] === 404) {
        return validateID;
      }
      const response = await this.prisma.tariff.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      console.error('Error removing tariff:', error);
      throw new Error('Error removing tariff');
    }
  }
}
