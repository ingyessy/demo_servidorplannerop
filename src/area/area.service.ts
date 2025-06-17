import { Injectable } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { validate } from 'class-validator';

/**
 * Servicio para gestionar areas
 * @class AreaService
 */
@Injectable()
export class AreaService {
  constructor(private prisma: PrismaService) {}
  /**
   * Crear un area
   * @param createAreaDto  Datos del area a crear
   * @returns  Area creada o mensaje de error
   */
  async create(createAreaDto: CreateAreaDto) {
    try {
      if (createAreaDto.id_user === undefined) {
        return { message: 'User ID is required', status: 400 };
      }
      const response = await this.prisma.jobArea.create({
        data: { ...createAreaDto, id_user: createAreaDto.id_user },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * devuelve todas las areas
   * @returns retorna todas las areas
   */
  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.jobArea.findMany({
        where: {id_site}
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * Busca un area por su ID
   * @param id  ID del area a buscar
   * @returns  Area encontrada o mensaje de error
   */
  async findOne(id: number, id_site?: number) {
    try {
      const response = await this.prisma.jobArea.findUnique({
        where: {
          id,
          id_site,
        },
      });
      if (!response) {
        return { message: 'Area not found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * actualiza un area
   * @param id  id del area a actualizar
   * @param updateAreaDto datos del area a actualizar
   * @returns area actualizada o mensaje de error
   */
  async update(id: number, updateAreaDto: UpdateAreaDto) {
    try {
      const validate = await this.findOne(id);
      if (validate['status'] === 404) {
        return validate;
      }
      const response = await this.prisma.jobArea.update({
        where: {
          id,
        },
        data: updateAreaDto,
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * Elimina un area
   * @param id id del area a eliminar
   * @returns retorna mensaje de exito o error
   */
  async remove(id: number, id_site?: number) {
    try {
      const validate = await this.findOne(id);
      if (validate['status'] === 404) {
        return validate;
      }
      if( id_site !== undefined && validate['id_site'] !== id_site) {
        return { message: 'Not authorized to delete this area', status: 403 };
      }
      const response = await this.prisma.jobArea.delete({
        where: {
          id,
        },
      });
      return response;
    } catch (error) {
      throw new Error(error);
    }
  }
}
