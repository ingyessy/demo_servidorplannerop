import { Injectable } from '@nestjs/common';
import { StatusComplete } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ValidationClientProgrammingService {
    constructor(private readonly prisma: PrismaService) {}
     /**
   * Validar si ya existe la programacion cliente
   * @param service_request - Solicitud de servicio
   * @param service - Servicio
   * @param dateStart - Fecha de inicio
   * @param timeStart - Hora de inicio
   * @param client - Cliente
   * @param ubication - Ubicación
   * @param id_operation - ID de la operación
   *
   */
  async validateClientProgramming({
    id_clientProgramming,
    service_request,
    service,
    dateStart,
    timeStart,
    client,
    ubication,
    status,
  }: {
    id_clientProgramming?: number | null;
    service_request?: string;
    service?: string;
    dateStart?: string;
    timeStart?: string;
    client?: string;
    ubication?: string;
    status?: string;
  }) {
    try {
      // Verificar que la programación del cliente no exista
      if (
        service_request &&
        service &&
        dateStart &&
        timeStart &&
        client &&
        ubication
      ) {
        const existingProgramming =
          await this.prisma.clientProgramming.findFirst({
            where: {
              service_request,
              service,
              dateStart: new Date(dateStart || ''),
              timeStart,
              client,
              ubication,
            },
          });

        if (existingProgramming) {
          return {
            message: 'Client programming already exists',
            status: 409,
          };
        }
      }

      if (service_request) {
        const serviceRequest = await this.prisma.clientProgramming.findFirst({
          where: { service_request },
        });
        if (serviceRequest) {
          return { message: 'Service alredy exists', status: 409 };
        }
      }

      // verificar si existe y tiene estado asignado
      if (id_clientProgramming) {
        const validateId = await this.prisma.clientProgramming.findUnique({
          where: { id: id_clientProgramming },
        });
        if (!validateId) {
          return { message: 'Client programming not found', status: 404 };
        }
        const programming = await this.prisma.clientProgramming.findFirst({
          where: {
            id: id_clientProgramming,
            status: StatusComplete.ASSIGNED,
          },
        });
        if (programming) {
          return {
            message: 'Client programming already exists and is assigned',
            status: 409,
          };
        }
      }

      // Si no existe, se puede proceder con la creación
      return { success: true };
    } catch (error) {
      console.error('Error validating client programming:', error);
      throw new Error(`Error validating client programming: ${error.message}`);
    }
  }
}
