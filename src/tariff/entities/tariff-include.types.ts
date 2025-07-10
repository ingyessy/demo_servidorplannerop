/**
 * Interfaz para la configuración de inclusión en consultas de tarifas
 */
export interface TariffIncludeConfig {
  subTask: {
    include: {
      task: boolean;
    };
  };
  costCenter: {
    include: {
      client: boolean;
      subSite: {
        include: {
          site: boolean;
        };
      };
    };
  };
  unitOfMeasure: boolean;
  user: boolean;
}

/**
 * Crea un objeto de configuración de inclusión para tarifas
 * @returns Configuración de inclusión completa para tarifas
 */
export function createTariffInclude(): TariffIncludeConfig {
  return {
    subTask: {
      include: {
        task: true
      }
    },
    costCenter: {
      include: {
        client: true,
        subSite: {
          include: {
            site: true
          }
        }
      }
    },
    unitOfMeasure: true,
    user: true
  };
}