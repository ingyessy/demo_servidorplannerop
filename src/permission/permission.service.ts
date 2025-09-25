import { Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { ca } from 'date-fns/locale';
import { FilterPermissionDto } from './dto/filter-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    private prisma: PrismaService,
    private validate: ValidationService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto, id_site?: number) {
  try {
    const validation = await this.validate.validateAllIds({
      workerIds: [createPermissionDto.id_worker],
    });
    if (validation && 'status' in validation && validation.status === 404) {
      return validation;
    }
    if (id_site !== undefined) {
      const workerValidation = validation?.existingWorkers?.[0];
      if (workerValidation && workerValidation.id_site !== id_site) {
        return {
          message: 'Not authorized to create permission for this worker',
          status: 409,
        };
      }
    }

    // Crear el permiso
    const response = await this.prisma.permission.create({
      data: { ...createPermissionDto },
    });

    // Comparar solo la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
    const todayStr = new Date().toISOString().split('T')[0];
    const dateDisableStartStr = new Date(createPermissionDto.dateDisableStart).toISOString().split('T')[0];

    if (dateDisableStartStr === todayStr) {
      // Actualizar el estado del trabajador a PERMISSION solo si el permiso inicia hoy
      await this.prisma.worker.update({
        where: { id: createPermissionDto.id_worker },
        data: { status: 'PERMISSION' },
      });
    }

    return response;
  } catch (error) {
    throw new Error(`Error creating permission: ${error}`);
  }
}

  async findByFilters(filters: FilterPermissionDto) {
    try {
      const validation = await this.validate.validateAllIds({
        workerIds: filters.id_worker ? [filters.id_worker] : [],
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const where: any = {};

      if (filters) {
        if (filters.id_worker) {
          where.id_worker = filters.id_worker;
        }
        if (filters.id_site) {
          where.worker = { id_site: filters.id_site };
        }
        if (filters.dateDisableEnd || filters.dateDisableStart) {
          if (filters.dateDisableEnd) {
            where.dateDisableEnd = filters.dateDisableEnd;
          }
          if (filters.dateDisableStart) {
            where.dateDisableStart = filters.dateDisableStart;
          }
        }
      }
      const response = await this.prisma.permission.findMany({
        where,
        include: {
          worker: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          dateDisableStart: 'desc',
        },
      });

      if (!response || response.length === 0) {
        return { status: 404, message: 'No permisssions found' };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding permissions by filters: ${error}`);
    }
  }

  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.permission.findMany({
        where: {
          worker: { id_site },
        },
        include: {
          worker: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
      });
      if (!response || response.length === 0) {
        return { status: 404, message: 'No permissions found' };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding all permissions: ${error}`);
    }
  }

  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.permission.findUnique({
        where: { id, worker: { id_site } },
        include: {
          worker: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
      });
      if (!response) {
        return { status: 404, message: `Permission with id ${id} not found` };
      }
      return response;
    } catch (error) {
      throw new Error(`Error finding permission with id ${id}: ${error}`);
    }
  }

  async update(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
    id_site?: number,
  ) {
    try {
      const validation = await this.findOne(id);
      if (validation['status'] != undefined) {
        return validation;
      }
      if (id_site !== undefined) {
        const workerValidation = await this.validate.validateAllIds({
          workerIds: [validation['id_worker']],
        });
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to update permission for this worker',
            status: 409,
          };
        }
      }
      const response = await this.prisma.permission.update({
        where: { id },
        data: { ...updatePermissionDto },
      });
      return response;
    } catch (error) {
      throw new Error(`Error updating permission with id ${id}: ${error}`);
    }
  }

  async remove(id: number, id_site?: number) {
    try {
      const validation = await this.findOne(id);
      if (validation['status'] != undefined) {
        return validation;
      }
      if (id_site !== undefined) {
        const workerValidation = await this.validate.validateAllIds({
          workerIds: [validation['id_worker']],
        });
        if (workerValidation && workerValidation.id_site !== id_site) {
          return {
            message: 'Not authorized to remove permission for this worker',
            status: 409,
          };
        }
      }
      const response = await this.prisma.permission.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error(`Error removing permission with id ${id}: ${error}`);
    }
  }
}
