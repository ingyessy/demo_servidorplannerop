import { Injectable } from '@nestjs/common';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

/**
 * Servicio para gestionar trabajadores
 * @class workerService
 * @category Service
 */
@Injectable()
export class WorkerService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
  ) {}
  /**
   * craer un trabajador
   * @param createWorkerDto datos del trabajador a crear
   * @returns respuesta de la creacion del trabajador
   */
  async create(createWorkerDto: CreateWorkerDto, id_site?: number) {
    try {
      const { dni, id_area, id_user, phone, code, payroll_code } = createWorkerDto;
      const validation = await this.validationService.validateAllIds({
        id_user: id_user,
        id_area: id_area,
        dni_worker: dni,
        code_worker: code,
        payroll_code_worker: payroll_code,
        phone_worker: phone,
      });
      if (validation['area'].id_site !== id_site) {
        return {
          message: 'Not authorized to create worker in this area',
          status: 409,
        };
      }
      // Si hay un error, retornarlo
      if (
        validation &&
        'status' in validation &&
        (validation.status === 404 || validation.status === 409)
      ) {
        return validation;
      }

      // Ensure id_user is defined before creating worker
      if (createWorkerDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }

      const response = await this.prisma.worker.create({
        data: {
          ...createWorkerDto,
          id_user: createWorkerDto.id_user,
        },
      });

      return response;
    } catch (error) {
      throw new Error(error.message || String(error));
    }
  }
  /**
   * obtener trabajador por dni
   * @param dni numero de identificacion del trabajador a buscar
   * @returns respuesta de la busqueda del trabajador
   */
  async finDni(dni: string, id_site?: number) {
    const response = await this.prisma.worker.findFirst({
      where: { dni, id_site },
    });
    if (!response) {
      return { message: 'Not found', status: 404 };
    }
    return response;
  }

  /**
   * obtener todos los trabajadores
   * @returns resupuesta de la busqueda de todos los trabajadores
   */
  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.worker.findMany({
        where: {
          id_site,
        },
        include: {
          jobArea: {
            select: {
              id: true,
              name: true,
            },
          },
          Site: {
            select: {
              name: true,
            },
          },
        },
      });
      const transformResponse = response.map((res) => {
        const { id_area, ...rest } = res;
        return rest;
      });
      return transformResponse;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * obtener un trabajador por su ID
   * @param id id del trabajador a buscar
   * @returns resupuesta de la busqueda del trabajador
   */
  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.worker.findUnique({
        where: { id, id_site },
        include: {
          jobArea: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      if (!response) {
        return { message: 'Worker not found', status: 404 };
      }

      const { id_area, ...rest } = response;
      return rest;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * obtener un trabajador por su DNI
   * @param dni numero de identificacion del trabajador a buscar
   * @returns respuesta de la busqueda del trabajador
   */
  async findOneById(dni: string) {
    try {
      const response = await this.prisma.worker.findUnique({
        where: { dni },
      });
      if (!response) {
        return { message: 'Worker not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * actualizar un trabajador
   * @param id id del trabajador a actualizar
   * @param updateWorkerDto datos del trabajador a actualizar
   * @returns respuesta de la actualizacion del trabajador
   */
  async update(id: number, updateWorkerDto: UpdateWorkerDto, id_site?: number) {
    try {
      const validation = await this.validationService.validateAllIds({
        id_area: updateWorkerDto.id_area,
      });
      if (validation['area'].id_site !== id_site) {
        return {
          message: 'Not authorized to update worker in this area',
          status: 409,
        };
      }
      const response = await this.prisma.worker.update({
        where: { id, id_site },
        data: updateWorkerDto,
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * eliminar un trabajador
   * @param id id del trabajador a eliminar
   * @returns respuesta de la eliminacion del trabajador
   */
  async remove(id: number) {
    try {
      const response = await this.prisma.worker.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
}
