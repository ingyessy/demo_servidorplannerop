import { Injectable } from '@nestjs/common';
import { CreateSubsiteDto } from './dto/create-subsite.dto';
import { UpdateSubsiteDto } from './dto/update-subsite.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubsiteService {
  constructor(private prisma: PrismaService) {}
  async create(createSubsiteDto: CreateSubsiteDto) {
    try {
      const response = await this.prisma.subSite.create({
        data: {
          ...createSubsiteDto,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Error creating subsite');
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.subSite.findMany({
        include: {
          site: true,
        },
      });
      if (!response || response.length === 0) {
        return { status: 404, message: 'No subsites found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching subsites');
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.subSite.findUnique({
        where: { id },
        include: {
          site: true,
        },
      });
      if (!response) {
        return { status: 404, message: 'Subsite not found' };
      }
      return response;
    } catch (error) {
      throw new Error('Error fetching subsite');
    }
  }

  async update(id: number, updateSubsiteDto: UpdateSubsiteDto) {
    try {
      const response = await this.prisma.subSite.update({
        where: { id },
        data: {
          ...updateSubsiteDto,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Error updating subsite');
    }
  }

  async remove(id: number) {
    try {
      const response = await this.prisma.subSite.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error('Error removing subsite');
    }
  }
}
