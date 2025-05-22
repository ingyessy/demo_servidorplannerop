import { Injectable } from '@nestjs/common';
import { CreateClientProgrammingDto } from './dto/create-client-programming.dto';
import { UpdateClientProgrammingDto } from './dto/update-client-programming.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

@Injectable()
export class ClientProgrammingService {
  constructor(
    private prisma: PrismaService,
    private validation: ValidationService,
  ) {}
  async create(createClientProgrammingDto: CreateClientProgrammingDto) {
    try {
      const validationProgramming =
        await this.validation.validateClientProgramming({
          service_request: createClientProgrammingDto.service_request,
          service: createClientProgrammingDto.service,
          client: createClientProgrammingDto.client,
          ubication: createClientProgrammingDto.ubication,
          dateStart: createClientProgrammingDto.dateStart,
          timeStart: createClientProgrammingDto.timeStart,
        });
      if (
        validationProgramming &&
        'status' in validationProgramming &&
        validationProgramming.status === 409
      ) {
        return validationProgramming;
      }

      const response = await this.prisma.clientProgramming.create({
        data: {
          ...createClientProgrammingDto,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Failed to create client programming');
    }
  }

  async findAll() {
    try {
      const response = await this.prisma.clientProgramming.findMany();
      if (!response || response.length === 0) {
        return {
          status: 404,
          message: 'Not Found Client Programming',
        };
      }
      return response;
    } catch (error) {
      throw new Error('Failed to fetch client programming');
    }
  }

  async findOne(id: number) {
    try {
      const response = await this.prisma.clientProgramming.findUnique({
        where: {
          id,
        },
      });
      if (!response) {
        return {
          status: 404,
          message: 'Not Found Client Programming',
        };
      }
      return response;
    } catch (error) {
      throw new Error('Failed to fetch client programming');
    }
  }

  async update(
    id: number,
    updateClientProgrammingDto: UpdateClientProgrammingDto,
  ) {
    try {
      const validateId = await this.findOne(id);
      if (validateId && 'status' in validateId && validateId.status === 404) {
        return validateId;
      }
      const response = await this.prisma.clientProgramming.update({
        where: {
          id,
        },
        data: {
          ...updateClientProgrammingDto,
        },
      });
      return response;
    } catch (error) {
      throw new Error('Failed to update client programming');
    }
  }

  async remove(id: number) {
    try {
      const validateId = await this.findOne(id);
      if (validateId && 'status' in validateId && validateId.status === 404) {
        return validateId;
      }
      const response = await this.prisma.clientProgramming.delete({
        where: { id },
      });
      return response;
    } catch (error) {
      throw new Error('Failed to delete client programming');
    }
  }
}
