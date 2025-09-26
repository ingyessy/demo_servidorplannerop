import { ConflictException, Injectable } from '@nestjs/common';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

@Injectable()
export class SubtaskService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
  ) {}
  // async create(createSubtaskDto: CreateSubtaskDto, id_site?: number) {
  //   try {
  //     const validationIdTask = await this.validation.validateAllIds({
  //       id_task: createSubtaskDto.id_task,
  //     });
  //     if (id_site && validationIdTask.task.id_site !== id_site) {
  //       return {
  //         status: 403,
  //         message: 'Forbidden: Task does not belong to this site',
  //       };
  //     }
  //     const response = await this.prisma.subTask.create({
  //       data: {
  //         ...createSubtaskDto,
  //       },
  //     });
  //     return response;
  //   } catch (error) {
  //     if (error.code === 'P2002') {
  //       const target = error.meta?.target;
  //       const fieldName = Array.isArray(target) ? target[0] : target;

  //       return {
  //         message: `Subtask with ${fieldName} '${createSubtaskDto[fieldName]}' already exists`,
  //         status: 409,
  //       };
  //     }
  //     throw new Error('Error creating subtask');
  //   }
  // }

  // async findAll(id_site?: number, subsiteId?: number) {
  //   try {
  //     const response = await this.prisma.subTask.findMany({
  //       where: { task: { id_site, id_subsite: subsiteId } },
  //       include: {
  //         Tariff: true,
  //         task: {
  //           include: {
  //             subSite: true,
  //           },
  //         }
  //       }
  //     });
  //     if (!response || response.length === 0) {
  //       return { status: 404, message: 'No subtasks found' };
  //     }
  //     return response;
  //   } catch (error) {
  //     throw new Error('Error fetching subtasks');
  //   }
  // }

  async create(createSubtaskDto: CreateSubtaskDto, id_site?: number) {
  try {
    // Limpia cualquier campo 'task' que pueda venir en el DTO
    if ('task' in createSubtaskDto) {
      delete (createSubtaskDto as any).task;
    }

    const validationIdTask = await this.validation.validateAllIds({
      id_task: createSubtaskDto.id_task,
    });
    if (id_site && validationIdTask.task.id_site !== id_site) {
      return {
        status: 403,
        message: 'Forbidden: Task does not belong to this site',
      };
    }

    const { name, code, status, id_task, id_subsite, id_client } = createSubtaskDto;

    console.log('Datos enviados a Prisma:', { name, code, status, id_task, id_subsite, id_client });

    const response = await this.prisma.subTask.create({
      data: {
        name,
        code,
        status,
        id_task,
        id_subsite,
        id_client,
      },
    });
    return response;
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      const fieldName = Array.isArray(target) ? target[0] : target;

      return {
        message: `Subtask with ${fieldName} '${createSubtaskDto[fieldName]}' already exists`,
        status: 409,
      };
    }
    throw new Error('Error creating subtask');
  }
}

  async findAll(id_site?: number, id_subsite?: number | null) {
    try {
      const response = await this.prisma.subTask.findMany({
        where: {
          task: {
            id_site: id_site,
          },
          ...(typeof id_subsite === 'number' ? { id_subsite } : {}),
    
        },
        include: {
          client: true,
          Tariff: true,
          task: {
            include: {
              subSite: true,
            },
          },
        },
      });
      if (!response || response.length === 0) {
        return { status: 404, message: 'No subtasks found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching subtasks');
    }
  }
  async findOne(id: number, id_site?: number) {
  try {
    const response = await this.prisma.subTask.findUnique({
      where: { id },
      include: {
        client: true,
        Tariff: true,
        task: {
          include: {
            subSite: true,
          },
        },
      },
    });
    if (!response) {
      return { status: 404, message: 'Subtask not found' };
    }
    // Si necesitas filtrar por id_site, hazlo manualmente:
    if (id_site && response.task?.id_site !== id_site) {
      return { status: 403, message: 'Forbidden: Task does not belong to this site' };
    }
   
    return response;
  } catch (error) {
    throw new Error('Error fetching subtask');
  }
}

  async update(
    id: number,
    updateSubtaskDto: UpdateSubtaskDto,
    id_site?: number,
  ) {
    try {
      const validationIdTask = await this.validation.validateAllIds({
        id_task: updateSubtaskDto.id_task,
      });
      if (id_site && validationIdTask.task) {
        if (validationIdTask.task.id_site !== id_site) {
          return {
            status: 403,
            message: 'Forbidden: Task does not belong to this site',
          };
        }
      }
      const foundSubtask = await this.prisma.subTask.findFirst({
        where: { id, task: { id_site } },
      });

      if (!foundSubtask) {
        return { status: 404, message: 'Subtask not found' };
      }

      const response = await this.prisma.subTask.update({
        where: { id },
        data: {
          ...updateSubtaskDto,
        },
      });

      // Solo validar y actualizar el código SI es diferente al actual
      if (
        updateSubtaskDto.code &&
        updateSubtaskDto.code !== foundSubtask.code
      ) {
        const validationCode = await this.validation.validateAllIds({
          code_tariff: updateSubtaskDto.code,
        });

        if (validationCode.status === 409) {
          throw new ConflictException(validationCode.message);
        }

        await this.prisma.tariff.update({
          where: { code: foundSubtask.code },
          data: {
            code: updateSubtaskDto.code,
          },
        });
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  async remove(id: number, id_site?: number) {
    try {
      const validationSubtask = await this.findOne(id, id_site);
      if (validationSubtask.status === 404) {
        return validationSubtask;
      }
      const response = await this.prisma.subTask.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error('Error deleting subtask');
    }
  }
}
