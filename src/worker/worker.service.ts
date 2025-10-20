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
      const { dni, id_area, id_user, phone, code, payroll_code } =
        createWorkerDto;
        // Check if code exists but is assigned to a deactivated worker
    const existingWorker = await this.prisma.worker.findFirst({
      where: { 
        code,
        status:{
        not: 'DEACTIVATED'
        }
      }
    });

    // If code is in use by an active worker, return error
    if (existingWorker) {
      return {
        message: 'Worker code already in use by an active worker',
        status: 409,
      };
    }
      const validation = await this.validationService.validateAllIds({
        id_user: id_user,
        id_area: id_area,
        dni_worker: dni,
        code_worker: code,
        payroll_code_worker: payroll_code,
        phone_worker: phone,
      });

      // Agrega los logs aquí para depuración
      console.log('DTO:', createWorkerDto);
      console.log('id_site usuario:', id_site);
      console.log('Validación área:', validation['area']);

      // Si la validación falla, retorna el error
      // if (
      //   !validation['area'] ||
      //   (validation['area'] && validation['area'].id_site !== id_site)
      // ) {
      //   return {
      //     message: 'Not authorized to create worker in this area',
      //     status: 409,
      //   };
      // }
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
   * @param id_site filtro por sede (opcional)
   * @param id_subsite filtro por subsede (opcional)
   * @param globalSearch si es true, no filtra por sede para mostrar nombres globalmente
   * @returns respuesta de la búsqueda de todos los trabajadores
   */
  // async findAll(id_site?: number, id_subsite?: number | null, globalSearch: boolean = false) {
  //   try {
  //     let whereClause: any = {};

  //     // Solo filtrar por sede si no es búsqueda global
  //     if (!globalSearch && id_site) {
  //       whereClause.id_site = id_site;
  //     }

  //     // Solo filtrar por id_subsite si es un número válido (no null ni undefined) y no es búsqueda global
  //     if (!globalSearch && typeof id_subsite === 'number') {
  //       whereClause.id_subsite = id_subsite;
  //     }

  //     const response = await this.prisma.worker.findMany({
  //       where: whereClause,
  //       include: {
  //         jobArea: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //         Site: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //       },
  //     });

  //     const transformResponse = response.map((res) => {
  //       const { id_area, ...rest } = res;
  //       return {
  //         ...rest,
  //         siteName: rest.Site?.name,
  //         areaName: rest.jobArea?.name,
  //       };
  //     });
  //     return transformResponse;
  //   } catch (error) {
  //     throw new Error(error);
  //   }
  // }

  // async findAll(id_site?: number, id_subsite?: number | null) {
  //   try {
  //     let whereClause: any = {};

  //     if (id_site) {
  //       whereClause.id_site = id_site;
  //     }

  //     // Solo filtrar por id_subsite si es un número válido (no null ni undefined)
  //     if (typeof id_subsite === 'number') {
  //       whereClause.id_subsite = id_subsite;
  //     }

  //     const response = await this.prisma.worker.findMany({
  //       where: whereClause,
  //       include: {
  //         jobArea: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //         Site: {
  //           select: {
  //             name: true,
  //           },
  //         },
  //       },
  //     });

  //     const transformResponse = response.map((res) => {
  //       const { id_area, ...rest } = res;
  //       return rest;
  //     });
  //     return transformResponse;
  //   } catch (error) {
  //     throw new Error(error);
  //   }
  // }

  // async findAll(id_site?: number) {
  //   try {
  //     const response = await this.prisma.worker.findMany({
  //       where: {
  //         id_site,
  //       },
  //       include: {
  //         jobArea: {
  //           select: {
  //             id: true,
  //             name: true,
  //           },
  //         },
  //         Site: {
  //           select: {
  //             name: true,
  //           },
  //         },
  //       },
  //     });
  //     const transformResponse = response.map((res) => {
  //       const { id_area, ...rest } = res;
  //       return rest;
  //     });
  //     return transformResponse;
  //   } catch (error) {
  //     throw new Error(error);
  //   }
  // }

  async findAll(id_site?: number, id_subsite?: number | null) {
    try {
      let whereClause: any = {};

      if (id_site) {
        whereClause.id_site = id_site;
      }

      // // Solo filtra por subsede si es un número válido (no null ni undefined)
      // if (typeof id_subsite === 'number') {
      //   whereClause.id_subsite = id_subsite;
      // }

      const response = await this.prisma.worker.findMany({
        where: whereClause,
        include: {
          jobArea: {
            select: {
              id: true,
              name: true,
            },
          },
          Site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      const result = response.map((res) => ({
        ...res,
        siteName: res.Site?.name,
        areaName: res.jobArea?.name,
      }));

      return result;
    } catch (error) {
      throw new Error('Error get all Worker');
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
          message: 'Not authorized to update worker in this site',
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

  // async addWorkedHoursOnOperationEnd(operationId: number) {
  //   // Obtener la operación y sus trabajadores
  //   const operation = await this.prisma.operation.findUnique({
  //     where: { id: operationId },
  //     include: { workers: true },
  //   });

  //   if (!operation || !operation.dateEnd || !operation.timeEnd) return;

  //   // Calcular horas trabajadas
  //   const start = new Date(operation.dateStart);
  //   const end = new Date(operation.dateEnd);

  //   // Si tienes timeStart y timeEnd como string tipo "HH:mm"
  //   const [startHour, startMin] = operation.timeStrat.split(':').map(Number);
  //   const [endHour, endMin] = operation.timeEnd.split(':').map(Number);

  //   start.setHours(startHour, startMin, 0, 0);
  //   end.setHours(endHour, endMin, 0, 0);

  //   const diffMs = end.getTime() - start.getTime();
  //   const diffHours = diffMs / (1000 * 60 * 60);

  //   // Sumar horas trabajadas a cada trabajador
  //   for (const opWorker of operation.workers) {
  //     await this.prisma.worker.update({
  //       where: { id: opWorker.id_worker },
  //       data: {
  //         hoursWorked: {
  //           increment: diffHours,
  //         },
  //       },
  //     });
  //   }
  // }

  // async addWorkedHoursOnOperationEnd(operationId: number) {
  //   // Obtener los Operation_Worker asociados a la operación, con fechas y horas de cada uno
  //   const operationWorkers = await this.prisma.operation_Worker.findMany({
  //     where: { id_operation: operationId },
  //     select: {
  //       id_worker: true,
  //       dateStart: true,
  //       dateEnd: true,
  //       timeStart: true,
  //       timeEnd: true,
  //     },
  //   });

  //   for (const opWorker of operationWorkers) {
  //     // Validar que existan fechas y horas
  //     if (
  //       !opWorker.dateStart ||
  //       !opWorker.dateEnd ||
  //       !opWorker.timeStart ||
  //       !opWorker.timeEnd
  //     ) {
  //       continue;
  //     }

  //     // Crear objetos Date para inicio y fin
  //     const start = new Date(opWorker.dateStart);
  //     const end = new Date(opWorker.dateEnd);

  //     // Parsear horas y minutos
  //     const [startHour, startMin] = opWorker.timeStart.split(':').map(Number);
  //     const [endHour, endMin] = opWorker.timeEnd.split(':').map(Number);

  //     start.setHours(startHour, startMin, 0, 0);
  //     end.setHours(endHour, endMin, 0, 0);

  //     const diffMs = end.getTime() - start.getTime();
  //     const diffHours = diffMs / (1000 * 60 * 60);

  //     // Solo sumar si la diferencia es positiva
  //     if (diffHours > 0) {
  //       await this.prisma.worker.update({
  //         where: { id: opWorker.id_worker },
  //         data: {
  //           hoursWorked: {
  //             increment: diffHours,
  //           },
  //         },
  //       });
  //     }
  //   }
  // }

  async addWorkedHoursOnOperationEnd(operationId: number) {
  const operationWorkers = await this.prisma.operation_Worker.findMany({
    where: { id_operation: operationId },
    select: { id_worker: true, dateStart: true, dateEnd: true, timeStart: true, timeEnd: true },
  });

  for (const { id_worker, dateStart, dateEnd, timeStart, timeEnd } of operationWorkers) {
     if (!dateStart || !dateEnd || !timeStart || !timeEnd) {
    console.log(`Datos incompletos para worker ${id_worker}`);
    continue;
  }

    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const [sh, sm] = timeStart.split(':').map(Number);
    const [eh, em] = timeEnd.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);
    end.setHours(eh, em, 0, 0);

    const diffHours = (end.getTime() - start.getTime()) / 3_600_000;
    console.log(`diffHours para worker ${id_worker}:`, diffHours);
    if (diffHours > 0) {
       console.log(`Sumando ${diffHours} horas a worker ${id_worker}`);
      await this.prisma.worker.update({
        where: { id: id_worker },
        data: { hoursWorked: { increment: diffHours } },
      });
    }
  }
}
}
