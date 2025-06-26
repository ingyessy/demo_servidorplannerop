import { Injectable } from '@nestjs/common';
import { CreateUnitOfMeasureDto } from './dto/create-unit-of-measure.dto';
import { UpdateUnitOfMeasureDto } from './dto/update-unit-of-measure.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UnitOfMeasureService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUnitOfMeasureDto: CreateUnitOfMeasureDto) {
    try {
      const response = await this.prisma.unitOfMeasure.create({
        data: createUnitOfMeasureDto,
      });
      return response;
    } catch (error) {
      console.error('Error creating unit of measure:', error);
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;
        return {
          message: `Unit of measure with ${fieldName} '${createUnitOfMeasureDto[fieldName]}' already exists`,
          status: 409,
        };
      }
      throw new Error('Error creating unit of measure');
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.unitOfMeasure.findMany();
      if (!response || response.length === 0) {
        return { status: 404, message: 'No unit of measures found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching all unit of measures');
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.unitOfMeasure.findUnique({
        where: { id },
      });
      if (!response) {
        return { status: 404, message: 'Unit of measure not found' };
      }
      return response;
    } catch (error) {
      throw new Error(`Error fetching unit of measure with id ${id}`);
    }
  }

  async update(id: number, updateUnitOfMeasureDto: UpdateUnitOfMeasureDto) {
    try {
      const validateID = await this.findOne(id);
      if (validateID['status'] === 404) {
        return validateID;
      }
      const response = await this.prisma.unitOfMeasure.update({
        where: { id },
        data: updateUnitOfMeasureDto,
      });
      return response;
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;
        return {
          message: `Unit of measure with ${fieldName} '${updateUnitOfMeasureDto[fieldName]}' already exists`,
          status: 409,
        };
      }
      throw new Error(`Error updating unit of measure with id ${id}`);
    }
  }

  async remove(id: number) {
    try {
      const validateID = await this.findOne(id);
      if (validateID['status'] === 404) {
        return validateID;
      }
      await this.prisma.unitOfMeasure.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(`Error removing unit of measure with id ${id}`);
    }
  }
}
