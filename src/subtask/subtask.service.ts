import { Injectable } from '@nestjs/common';
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
  async create(createSubtaskDto: CreateSubtaskDto, id_site?: number) {
    try {
      const validationIdTask = await this.validation.validateAllIds({
        id_task: createSubtaskDto.id_task,
      });
      if (id_site && validationIdTask.task.id_site !== id_site) {
        return {
          status: 403,
          message: 'Forbidden: Task does not belong to this site',
        };
      }
      const response = await this.prisma.subTask.create({
        data: {
          ...createSubtaskDto,
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

  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.subTask.findMany({
        where: { task: { id_site } },
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
        where: { id, task: { id_site } },
      });
      if (!response) {
        return { status: 404, message: 'Subtask not found' };
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
      const response = await this.prisma.subTask.update({
        where: { id },
        data: {
          ...updateSubtaskDto,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Error updating subtask');
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
