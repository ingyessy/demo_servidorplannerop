import { Injectable } from '@nestjs/common';
import { CreateConfigurationDto } from './dto/create-configuration.dto';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConfigurationService {
  constructor(private prisma: PrismaService) {}
  async create(createConfigurationDto: CreateConfigurationDto) {
    try {
      const response = await this.prisma.configuration.create({
        data: createConfigurationDto,
      });
      return response;
    } catch (error) {
      console.error('Error creating configuration:', error);
      throw new Error('Error creating configuration');
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.configuration.findMany();
      if (response.length === 0) {
        return { message: 'No configurations found', status: 404 };
      }
      return response;
    } catch (error) {
      console.error('Error fetching configurations:', error);
      throw new Error('Error fetching configurations');
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.configuration.findUnique({
        where: { id },
      });
      if (!response) {
        return { message: 'Configuration not found', status: 404 };
      }
      return response;
    } catch (error) {
      console.error('Error fetching configuration:', error);
      throw new Error('Error fetching configuration');
    }
  }

  async update(id: number, updateConfigurationDto: UpdateConfigurationDto) {
    try {
      const validateId = await this.findOne(id);
      if (validateId['status'] === 404) {
        return validateId;
      }
      const response = await this.prisma.configuration.update({
        where: { id },
        data: updateConfigurationDto,
      });
      return response;
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw new Error('Error updating configuration');
    }
  }

  async remove(id: number) {
    try {
      const validateId = await this.findOne(id);
      if (validateId['status'] === 404) {
        return validateId;
      }
      const response = await this.prisma.configuration.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      console.error('Error removing configuration:', error);
      throw new Error('Error removing configuration');
    }
  }
}
