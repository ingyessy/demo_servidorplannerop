import { Injectable } from '@nestjs/common';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
/**
 * Servicio para gestionar las atenciones llamadas
 * @class CalledAttentionService
 * @category Service
 */
@Injectable()
export class CalledAttentionService {
  /**
   *  Constructor del servicio
   * @param prisma 
   * @param validation 
   */
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
  ) {}

  /**
   * Crear una atencion llamada
   * @param createCalledAttentionDto datos de la atencion llamada a crear
   * @returns respuesta de la creacion de la atencion llamada
   */
  async create(createCalledAttentionDto: CreateCalledAttentionDto) {
    try {
      if (createCalledAttentionDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }

      const validation = await this.validation.validateAllIds({
        workerIds: [createCalledAttentionDto.id_worker],
      });
      if (validation && 'status' in validation && validation.status === 404) {
        return validation;
      }
      const response = await this.prisma.calledAttention.create({
        data: {
          ...createCalledAttentionDto,
          id_user: createCalledAttentionDto.id_user,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Obtener todas las atenciones llamadas
   * @returns respuesta de la busqueda de todas las atenciones llamadas
   */
  async findAll() {
    try {
      const response = await this.prisma.calledAttention.findMany();
      if (!response) {
        return { message: 'Called Attention not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }
  
  /**
   * Obtener una atencion llamada por ID
   * @param id ID de la atencion llamada a buscar
   * @returns respuesta de la busqueda de la atencion llamada
   */
  async findOne(id: number) {
    try {
      const response = await this.prisma.calledAttention.findUnique({
        where: {
          id,
        },
      });
      if (!response) {
        return { message: 'Called Attention not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Actualizar una atencion llamada
   * @param id ID de la atencion llamada a actualizar
   * @param updateCalledAttentionDto datos de la atencion llamada a actualizar
   * @returns respuesta de la actualizacion de la atencion llamada
   */
  async update(id: number, updateCalledAttentionDto: UpdateCalledAttentionDto) {
    try {
      const validationCalled = await this.findOne(id);
      if (validationCalled['status'] === 404) {
        return validationCalled;
      }
      if (updateCalledAttentionDto.id_worker === undefined) {
        return { message: 'Worker ID is required', status: 400 };
      }
      const validadionGlobal = await this.validation.validateAllIds({
        workerIds: [updateCalledAttentionDto.id_worker],
      });
      if (
        validadionGlobal &&
        'status' in validadionGlobal &&
        validadionGlobal.status === 404
      ) {
        return validadionGlobal;
      }
      const response = await this.prisma.calledAttention.update({
        where: { id },
        data: updateCalledAttentionDto,
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Eliminar una atencion llamada
   * @param id ID de la atencion llamada a eliminar
   * @returns respuesta de la eliminacion de la atencion llamada
   * @throws Error
   */
  async remove(id: number) {
    try {
      const validadionCalled = await this.findOne(id);
      if (validadionCalled['status'] === 404) {
        return validadionCalled;
      }
      const response = await this.prisma.calledAttention.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
