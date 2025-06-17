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
  async create(createSubtaskDto: CreateSubtaskDto) {
    try {
      const validationIdTask = await this.validation.validateAllIds({
        id_task: createSubtaskDto.id_task,
      });
      console.log('validationIdTask', validationIdTask);
      const response = await this.prisma.subTask.create({
        data: {
          ...createSubtaskDto,
        },
      });
      return response;
    } catch (error) {
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

  async update(id: number, updateSubtaskDto: UpdateSubtaskDto) {
    try {
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

  async remove(id: number) {
    try {
      const response = await this.prisma.subTask.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error('Error deleting subtask');
    }
  }
}
