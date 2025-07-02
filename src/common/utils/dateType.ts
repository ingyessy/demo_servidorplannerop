import { format, getDay, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { getColombiaHolidays } from 'colombia-holidays';

/**
 * Tipos posibles de día en Colombia
 */
export enum DayType {
  NORMAL = 'NORMAL',
  SUNDAY = 'SUNDAY',
  HOLIDAY = 'HOLIDAY',
}

/**
 * Información detallada sobre una fecha
 */
export interface DateInfo {
  type: DayType;
  isHoliday: boolean;
  isSunday: boolean;
  name?: string;
  date: Date;
  formattedDate: string;
  dayOfWeek: string;
}

// Cache para no recalcular los festivos repetidamente
const holidayCache = new Map<number, any[]>();

/**
 * Obtiene festivos colombianos para un año específico
 * @param year El año para el que se requieren los festivos
 * @returns Array con los festivos de Colombia
 */
export function getColombiaDaysOff(year: number): any[] {
  if (!holidayCache.has(year)) {
    const holidays = getColombiaHolidays(year);
    holidayCache.set(year, holidays);
  }
  return holidayCache.get(year) || [];
}

/**
 * Obtiene el número de semana del año para una fecha específica
 * @param date Fecha para la cual se quiere obtener el número de semana
 * @returns Número de semana (1-53)
 */
export function getWeekNumber(date: Date): number {
  // Utiliza la función getWeek de date-fns con configuración para semanas ISO
  // (semana empieza lunes, primera semana tiene al menos 4 días)
  return getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
}

/**
 * Obtiene información básica sobre la semana de una fecha
 * @param date Fecha para la cual se quiere obtener información de semana
 * @returns Objeto con número de semana y año
 */
export function getWeekInfo(date: Date): { weekNumber: number; year: number } {
  return {
    weekNumber: getWeekNumber(date),
    year: date.getFullYear(),
  };
}

/**
 * Determina si una fecha es festivo, domingo o día normal en Colombia
 * @param date Fecha a verificar
 * @returns Objeto con información del tipo de día
 */
export function getDateType(date: Date): DateInfo {
  // Normalizar la fecha para evitar problemas con horas
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  // Verificar si es domingo
  const isSunday = getDay(normalizedDate) === 0;

  // Obtener festivos del año
  const year = normalizedDate.getFullYear();
  const holidays = getColombiaDaysOff(year);

  // Convertir fecha a formato YYYY-MM-DD para comparar
  const dateString = normalizedDate.toISOString().split('T')[0];

  // Verificar si es festivo
  const matchingHoliday = holidays.find(
    (holiday) => holiday.date === dateString,
  );
  const isHoliday = !!matchingHoliday;

  // Determinar tipo de día
  let type = DayType.NORMAL;
  if (isHoliday) {
    type = DayType.HOLIDAY;
  } else if (isSunday) {
    type = DayType.SUNDAY;
  }

  return {
    type,
    isHoliday,
    isSunday,
    name: matchingHoliday?.name,
    date: normalizedDate,
    formattedDate: format(normalizedDate, 'EEEE, d MMMM yyyy', { locale: es }),
    dayOfWeek: format(normalizedDate, 'EEEE', { locale: es }),
  };
}

/**
 * Verifica si una fecha es un día hábil en Colombia (no festivo, no domingo)
 * @param date Fecha a verificar
 * @returns true si es día hábil, false si no
 */
export function isBusinessDay(date: Date): boolean {
  const dateInfo = getDateType(date);
  return dateInfo.type === DayType.NORMAL;
}

/**
 * Verifica si una fecha es festivo en Colombia
 * @param date Fecha a verificar
 * @returns true si es festivo, false si no
 */
export function isHoliday(date: Date): boolean {
  const dateInfo = getDateType(date);
  return dateInfo.isHoliday;
}

/**
 * Verifica si una fecha es domingo
 * @param date Fecha a verificar
 * @returns true si es domingo, false si no
 */
export function isSunday(date: Date): boolean {
  const dateInfo = getDateType(date);
  return dateInfo.isSunday;
}

/**
 * Obtiene el próximo día hábil a partir de una fecha
 * @param date Fecha de referencia
 * @returns La siguiente fecha que es día hábil
 */
export function getNextBusinessDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}

/**
 * Obtiene todos los días hábiles en un rango de fechas
 * @param startDate Fecha de inicio
 * @param endDate Fecha final
 * @returns Array con todas las fechas que son días hábiles en el rango
 */
export function getBusinessDaysInRange(startDate: Date, endDate: Date): Date[] {
  const businessDays: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isBusinessDay(currentDate)) {
      businessDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return businessDays;
}

/**
 * Obtiene el nombre del día de la semana en español
 * @param date Fecha
 * @returns Nombre del día en español
 */
export function getDayName(date: Date): string {
  return format(date, 'EEEE', { locale: es });
}
