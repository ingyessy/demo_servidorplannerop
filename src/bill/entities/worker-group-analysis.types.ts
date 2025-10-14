/**
 * Tipos de horas para cálculos de nómina y facturación
 */
export enum HourType {
  OD = 'OD', // Ordinaria Diurna
  ON = 'ON', // Ordinaria Nocturna
  ED = 'ED', // Extra Diurna
  EN = 'EN', // Extra Nocturna
  FOD = 'FOD', // Festiva Ordinaria Diurna
  FON = 'FON', // Festiva Ordinaria Nocturna
  FED = 'FED', // Festiva Extra Diurna
  FEN = 'FEN', // Festiva Extra Nocturna
}
/** 
 * Tipos de horas para cálculos de facturación
 */
export enum BillingHourType {
  FAC_OD = 'FAC_OD',   // Facturación Ordinaria Diurna|
  FAC_ON = 'FAC_ON',   // Facturación Ordinaria Nocturna
  FAC_ED = 'FAC_ED',   // Facturación Extra Diurna
  FAC_EN = 'FAC_EN',   // Facturación Extra Nocturna
  FAC_FOD = 'FAC_FOD', // Facturación Festiva Ordinaria Diurna
  FAC_FON = 'FAC_FON', // Facturación Festiva Ordinaria Nocturna
  FAC_FED = 'FAC_FED', // Facturación Festiva Extra Diurna
  FAC_FEN = 'FAC_FEN'  // Facturación Festiva Extra Nocturna
}

/**
 * Interfaz para representar las horas adicionales
 */
export interface AdditionalHours {
  // Horas para nómina
  OD?: number;   // Ordinaria Diurna
  ON?: number;   // Ordinaria Nocturna
  ED?: number;   // Extra Diurna
  EN?: number;   // Extra Nocturna
  FOD?: number;  // Festiva Ordinaria Diurna
  FON?: number;  // Festiva Ordinaria Nocturna
  FED?: number;  // Festiva Extra Diurna
  FEN?: number;  // Festiva Extra Nocturna
  
  // Horas para facturación
  FAC_OD?: number;   // Facturación Ordinaria Diurna
  FAC_ON?: number;   // Facturación Ordinaria Nocturna
  FAC_ED?: number;   // Facturación Extra Diurna
  FAC_EN?: number;   // Facturación Extra Nocturna
  FAC_FOD?: number;  // Facturación Festiva Ordinaria Diurna
  FAC_FON?: number;  // Facturación Festiva Ordinaria Nocturna
  FAC_FED?: number;  // Facturación Festiva Extra Diurna
  FAC_FEN?: number;  // Facturación Festiva Extra Nocturna
  
  // Para compatibilidad con horas con prefijo H
  HOD?: number;
  HON?: number;
  HED?: number;
  HEN?: number;
  HFOD?: number;
  HFON?: number;
  HFED?: number;
  HFEN?: number;
}


/**
 * Interfaz para representar el resumen de un grupo de trabajadores
 */
export interface WorkerGroupSummary {
  groupId: string;
  task: string;
  site: string | null;
  subSite: string | null;
  id_unit_of_measure: number | null;
  unit_of_measure: string | null;
  id_facturation_unit: number | null;
  op_duration: number | null;
  facturation_unit: string | null;
  code_tariff: string | null;
  tariff: string | null;
  id_tariff: number | null;
  workerCount: number;
  facturation_tariff?: number;
  paysheet_tariff?: number;
  agreed_hours?: number;
  hours?: any;
  week_number?: number;
  full_tariff: string | undefined;
  compensatory: string | undefined;
  alternative_paid_service: string | undefined;
  group_tariff: string | undefined;
  settle_payment: string | undefined;
  id_operation?: number | null;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  timeRange: {
    start: string | null;
    end: string | null;
  };
   operation?: {
    op_duration?: number;
    
  };
  workers: any[];
}

/**
 * Interfaz para representar el análisis completo de grupos de trabajadores
 */
export interface WorkerGroupsAnalysis {
  totalGroups: number;
  totalWorkers: number;
  groups: WorkerGroupSummary[];
  uniqueTasks: string[];
}

/**
 * Interfaz para representar las horas adicionales
 */
export interface AdditionalHours {
  OD?: number; // Ordinaria Diurna
  ON?: number; // Ordinaria Nocturna
  ED?: number; // Extra Diurna
  EN?: number; // Extra Nocturna
  FOD?: number; // Festiva Ordinaria Diurna
  FON?: number; // Festiva Ordinaria Nocturna
  FED?: number; // Festiva Extra Diurna
  FEN?: number; // Festiva Extra Nocturna
}

/**
 * Interfaz para el resultado del cálculo
 */
export interface PayrollCalculationResult {
  baseAmount: number; // Monto base (trabajadores * tarifa)
  additionalHoursAmount: number; // Monto por horas adicionales
  holidayAmount: number; // Monto adicional por festivo/domingo
  totalAmount: number; // Monto total
  details: {
    // Detalles del cálculo
    workerCount: number;
    tariff: number;
    isHolidayOrSunday: boolean;
    holidayMultiplier: number;
    additionalHoursDetail: {
      [key: string]: {
        hours: number;
        multiplier: number;
        amount: number;
      };
    };
  };
}