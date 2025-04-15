import { StatusOperation } from "@prisma/client";

export interface OperationFilterDto {
    status?: StatusOperation[];
    dateStart?: Date;
    dateEnd?: Date;
    jobAreaId?: number;
    userId?: number;
    search?: string;
  }
  