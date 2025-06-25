import { Injectable } from '@nestjs/common';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService) {}
  async create(createSiteDto: CreateSiteDto) {
    try {
      const response = await this.prisma.site.create({
        data: {
          name: createSiteDto.name,
          status: createSiteDto.status,
        },
      });
      return response;
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target[0] : target;

        return {
          message: `Site with ${fieldName} '${createSiteDto[fieldName]}' already exists`,
          status: 409,
        };
      }
      throw new Error('Failed to create site');
    }
  }

  async findAll(id_site?: number) {
    try {
      const response = await this.prisma.site.findMany({
        include: { SubSite: true },
        where: {
          id: id_site
        }
      });
      if (!response || response.length === 0) {
        return { message: 'No sites found', status: 404 };
      }
      return response;
    } catch (error) {
      throw new Error('Failed to fetch sites');
    }
  }

  async findOne(id: number,  id_site?: number ) {
    try {
      const response = await this.prisma.site.findUnique({
        where: { id },
      });
      if (!response) {
        return { message: 'Site not found', status: 404 };
      }
      return response;
    } catch (error) {
      console.error('Error finding site:', error);
      throw new Error('Failed to find site');
    }
  }

  async update(id: number, updateSiteDto: UpdateSiteDto) {
    try {
      const existingSite = await this.findOne(id);
      if (existingSite.status === 404) {
        return existingSite;
      }
      const response = await this.prisma.site.update({
        where: { id },
        data: {
          name: updateSiteDto.name,
          status: updateSiteDto.status,
        },
      });
      return response;
    } catch (error) {
      console.error('Error updating site:', error);
      throw new Error('Failed to update site');
    }
  }

  async remove(id: number) {
    try {
      const existingSite = await this.findOne(id);
      if (existingSite.status === 404) {
        return existingSite;
      }
      const response = await this.prisma.site.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      console.error('Error deleting site:', error);
      throw new Error('Failed to delete site');
    }
  }
}
