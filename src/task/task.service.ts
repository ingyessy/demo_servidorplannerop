import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { StatusActivation } from '@prisma/client';
/**
 * Servicio para gestionar tareas
 * @class TaskService
 */
@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}
  /**
   * crear una tarea
   * @param createTaskDto datos de la tarea a crear
   * @returns respuesta de la creacion de la tarea
   */
  async create(createTaskDto: CreateTaskDto) {
    try {
      const { name } = createTaskDto;

      const validateTask = await this.findOneTaskName(name);
      if (validateTask['status'] !== 404) {
        return { message: 'Task already exists', status: 409 };
      }
      if (createTaskDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }
      const response = await this.prisma.task.create({
        data: { ...createTaskDto, id_user: createTaskDto.id_user },
      });
      return response;
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error('Error create Task');
    }
  }
  /**
   * obtener una tarea por su nombre
   * @param name nombre de la tarea a buscar
   * @returns respuesta de la busqueda de la tarea
   */
  async findOneTaskName(name: string, id_site?: number) {
    try {
      const response = await this.prisma.task.findMany({
        where: {
          id_site: id_site,
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });
      if (response.length === 0) {
        return { message: 'Task name not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error('Error get Task');
    }
  }
  /**
   * obtener todas las tareas
   * @returns respuesta de la busqueda de todas las tareas
   */
  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.task.findMany({
        where: {
          id_site: id_site,
        },
        include: {
          SubTask: true,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Error get all Task');
    }
  }
  /**
   * obtener una tarea por su ID
   * @param id id de la tarea a buscar
   * @returns respuesta de la busqueda de la tarea
   */
  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.task.findUnique({
        where: {
          id: id,
          id_site: id_site,
        },
        include: {
          SubTask: true,
        },
      });
      if (!response) {
        return { message: 'Task not founds', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error('Error get Task');
    }
  }
  /**
   * actualizar una tarea
   * @param id id  de la tarea a actualizar
   * @param updateTaskDto datos de la tarea a actualizar
   * @returns respuesta de la actualizacion de la tarea
   */
  async update(id: number, updateTaskDto: UpdateTaskDto) {
    try {
      const validateTask = await this.findOne(id);
      if (validateTask['status'] === 404) {
        return validateTask;
      }

      if (updateTaskDto.name && updateTaskDto.id_user) {
        const validateName = await this.findOneTaskName(updateTaskDto.name);
        if (validateName['status'] !== 404) {
          return { message: 'Task already exists', status: 409 };
        }
      }
      const response = await this.prisma.task.update({
        where: { id: id },
        data: updateTaskDto,
      });
      return response;
    } catch (error) {
      throw new Error('Error update Task');
    }
  }
  /**
   * eliminar una tarea
   * @param id tarea a eliminar
   * @returns respuesta de la eliminacion de la tarea
   */
  async remove(id: number) {
    try {
      const validateTask = await this.findOne(id);
      if (validateTask['status'] === 404) {
        return validateTask;
      }
      const response = await this.prisma.task.delete({
        where: { id: id },
      });
      return response;
    } catch (error) {
      throw new Error('Error delete Task');
    }
  }
}
