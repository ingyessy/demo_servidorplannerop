import { Prisma } from '@prisma/client';

/**
 * Interfaz para la configuración de inclusión en consultas de operaciones
 */
export interface OperationIncludeConfig {
  client: {
    select: { 
      name: boolean 
    };
  };
  jobArea: {
    select: {
      id: boolean;
      name: boolean;
    };
  };
  task: {
    select: {
      id: boolean;
      name: boolean;
    };
  };
  clientProgramming: {
    select: {
      service: boolean;
    };
  };
  Site: {
    select: {
      name: boolean;
    };
  };
  workers: {
    select: {
      id: boolean;
      id_worker: boolean;
      timeStart: boolean;
      timeEnd: boolean;
      dateStart: boolean;
      dateEnd: boolean;
      id_group: boolean;
      worker: {
        select: {
          id: boolean;
          name: boolean;
        };
      };
      task: {
        select: {
          id: boolean;
          name: boolean;
        };
      };
      tariff: { 
        include: { 
          subTask: boolean,
          unitOfMeasure: boolean, 
        } 
      };
    };
  };
  inChargeOperation: {
    select: {
      id_user: boolean;
      id_operation: boolean;
      user: {
        select: {
          id: boolean;
          name: boolean;
        };
      };
    };
  };
}

/**
 * Crea un objeto de configuración de inclusión para operaciones
 * @returns Configuración de inclusión de operaciones
 */
export function createOperationInclude(): OperationIncludeConfig {
  return {
    client: {
      select: { name: true },
    },
    jobArea: {
      select: {
        id: true,
        name: true,
      },
    },
    task: {
      select: {
        id: true,
        name: true,
      },
    },
    clientProgramming: {
      select: {
        service: true,
      },
    },
    Site: {
      select: {
        name: true,
      },
    },
    workers: {
      select: {
        id: true,
        id_worker: true,
        timeStart: true,
        timeEnd: true,
        dateStart: true,
        dateEnd: true,
        id_group: true,
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
          },
        },
        tariff: { include: { subTask: true, unitOfMeasure: true } },
      },
    },
    inChargeOperation: {
      select: {
        id_user: true,
        id_operation: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  };
}