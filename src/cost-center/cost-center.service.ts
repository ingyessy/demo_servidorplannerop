import { Injectable } from '@nestjs/common';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

@Injectable()
export class CostCenterService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
  ) {}
  async create(createCostCenterDto: CreateCostCenterDto) {
    try {
      const validate = await this.validation.validateAllIds({
        id_subsite: createCostCenterDto.id_subsite,
      });
      if (
        validate &&
        validate?.subsite?.id_site !== createCostCenterDto.id_site
      ) {
        return {
          message: 'This subsite does not belong to the site',
          status: 409,
        };
      }
      const response = await this.prisma.costCenter.create({
        data: {
          name: createCostCenterDto.name,
          code: createCostCenterDto.code,
          id_subsite: createCostCenterDto.id_subsite,
          id_user: createCostCenterDto.id_user!,
          id_client: createCostCenterDto.id_client,
          status: createCostCenterDto.status,
        },
      });
      return response;
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;
        return {
          message: `Cost center with ${fieldName} '${createCostCenterDto[fieldName]}' already exists`,
          status: 409,
        };
      }
      throw new Error('Error creating cost center');
    }
  }

  // async findAll(id_site: number, subsiteId: number) {
  //   try {
  //     const response = await this.prisma.costCenter.findMany({
  //       where: { subSite: { id_site, id: subsiteId } },
  //     });
  //     if (!response || response.length === 0) {
  //       return { status: 404, message: 'No cost centers found' };
  //     }
  //     return response;
  //   } catch (error) {
  //     console.error('Error fetching cost centers:', error);
  //     throw new Error('Error fetching cost centers');
  //   }
  // }

  async findAll(id_site: number, subsiteId: number) {
  try {
    let whereClause: any = {};

    // Si se pasa un subsiteId válido, filtra por ese subsite
    if (subsiteId) {
      whereClause.id_subsite = subsiteId;
    } else if (id_site) {
      // Si solo se pasa id_site, busca todos los id_subsite de ese sitio
      const subsites = await this.prisma.subSite.findMany({
        where: { id_site },
        select: { id: true },
      });
      const subsiteIds = subsites.map(s => s.id);
      whereClause.id_subsite = { in: subsiteIds };
    }

    const response = await this.prisma.costCenter.findMany({
      where: whereClause,
    });

    if (!response || response.length === 0) {
      return { status: 404, message: 'No cost centers found' };
    }
    return response;
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    throw new Error('Error fetching cost centers');
  }
}

  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.costCenter.findUnique({
        where: { id, subSite: { id_site } },
      });
      if (!response) {
        return { message: 'Cost center not found', status: 404 };
      }
      return response;
    } catch (error) {
      console.error('Error fetching cost center:', error);
      throw new Error('Error fetching cost center');
    }
  }

  async update(id: number, updateCostCenterDto: UpdateCostCenterDto) {
    try {
      const validateID = await this.findOne(id);
      if (validateID['status'] === 404) {
        return validateID;
      }
      const validate = await this.validation.validateAllIds({
        id_subsite: updateCostCenterDto.id_subsite,
      });
      if (updateCostCenterDto.id_site) {
        if (
          validate &&
          validate?.subsite?.id_site !== updateCostCenterDto.id_site
        ) {
          return {
            message: 'This subsite does not belong to the site',
            status: 409,
          };
        }
      }
      const response = await this.prisma.costCenter.update({
        where: { id },
        data: updateCostCenterDto,
      });
      return response;
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;
        return {
          message: `Cost center with ${fieldName} '${updateCostCenterDto[fieldName]}' already exists`,
          status: 409,
        };
      }
      throw new Error('Error updating cost center');
    }
  }

  async remove(id: number) {
    try {
      const validateID = await this.findOne(id);
      if (validateID['status'] === 404) {
        return validateID;
      }
      const response = await this.prisma.costCenter.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      console.error('Error removing cost center:', error);
      throw new Error('Error removing cost center');
    }
  }
}
