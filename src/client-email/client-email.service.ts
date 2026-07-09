import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientEmailDto } from './dto/create-client-email.dto';
import { UpdateClientEmailDto } from './dto/update-client-email.dto';

/**
 * Servicio para gestionar los correos de los clientes
 */
@Injectable()
export class ClientEmailService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un correo para un cliente
   */
  async create(createClientEmailDto: CreateClientEmailDto) {
    try {
      const client = await this.prisma.client.findUnique({
        where: {
          id: createClientEmailDto.id_client,
        },
        select: {
          id: true,
        },
      });

      if (!client) {
        return {
          message: 'Client not found',
          status: 404,
        };
      }

      const existEmail = await this.prisma.clientEmail.findFirst({
        where: {
          id_client: createClientEmailDto.id_client,
          email: createClientEmailDto.email,
        },
        select: {
          id: true,
        },
      });

      if (existEmail) {
        return {
          message: 'Email already registered for this client',
          status: 400,
        };
      }

      const response = await this.prisma.clientEmail.create({
        data: {
          ...createClientEmailDto,
        },
        select: {
          id: true,
          id_client: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Error: ${(error as Error).message}`);
    }
  }

  /**
   * Obtiene todos los correos de un cliente
   */
  async findByClient(idClient: number) {
    try {
      const client = await this.prisma.client.findUnique({
        where: {
          id: idClient,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!client) {
        return {
          message: 'Client not found',
          status: 404,
        };
      }

      const emails = await this.prisma.clientEmail.findMany({
        where: {
          id_client: idClient,
        },
        select: {
          id: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
        orderBy: {
          type: 'asc',
        },
      });

      return {
        ...client,
        emails,
      };
    } catch (error) {
      throw new Error(`Error: ${(error as Error).message}`);
    }
  }

  /**
   * Obtiene un correo por ID
   */
  async findOne(id: number) {
    try {
      const response = await this.prisma.clientEmail.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          id_client: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
      });

      if (!response) {
        return {
          message: 'Client email not found',
          status: 404,
        };
      }

      return response;
    } catch (error) {
      throw new Error(`Error: ${(error as Error).message}`);
    }
  }

  /**
   * Actualiza un correo
   */
  async update(id: number, updateClientEmailDto: UpdateClientEmailDto) {
    try {
      const validateEmail = await this.findOne(id);

      if (validateEmail['status'] === 404) {
        return validateEmail;
      }

      if (updateClientEmailDto.email) {
        const existEmail = await this.prisma.clientEmail.findFirst({
          where: {
            id_client: validateEmail['id_client'],
            email: updateClientEmailDto.email,
            NOT: {
              id,
            },
          },
          select: {
            id: true,
          },
        });

        if (existEmail) {
          return {
            message: 'Email already registered for this client',
            status: 400,
          };
        }
      }

      const response = await this.prisma.clientEmail.update({
        where: {
          id,
        },
        data: updateClientEmailDto,
        select: {
          id: true,
          id_client: true,
          email: true,
          type: true,
          name: true,
          status: true,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Error: ${(error as Error).message}`);
    }
  }

  async findAll() {
    try {

        const emails = await this.prisma.clientEmail.findMany({
            where: {
                status: "ACTIVE",
            },
            select: {
                id: true,
                id_client: true,
                email: true,
                name: true,
                type: true,
                status: true,
            },
            orderBy: {
                id: "desc",
            },
        });

        const clients = await this.prisma.client.findMany({
            select: {
                id: true,
                name: true,
            },
        });

        const clientMap = new Map(
            clients.map(client => [client.id, client.name])
        );

        return emails.map(email => ({
            ...email,
            clientName: clientMap.get(email.id_client) ?? "",
        }));

    } catch (error) {
        throw new Error((error as Error).message);
    }
}

  /**
   * Elimina un correo
   */
  async remove(id: number) {
    try {
      const validateEmail = await this.findOne(id);

      if (validateEmail['status'] === 404) {
        return validateEmail;
      }

      const response = await this.prisma.clientEmail.delete({
        where: {
          id,
        },
        select: {
          id: true,
          email: true,
        },
      });

      return response;
    } catch (error) {
      throw new Error(`Error: ${(error as Error).message}`);
    }
  }
}