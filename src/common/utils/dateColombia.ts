export const getColombianDateTime = () => {
  const now = new Date();
  // Convertir a hora colombiana (UTC-5)
  const colombianTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return colombianTime;
};

// Función para obtener solo la hora en formato HH:MM
export const getColombianTimeString = () => {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    timeZone: "America/Bogota",
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Crea el inicio del día en zona horaria de Colombia
 */
export const getColombianStartOfDay = (date: Date): Date => {
  const colombianDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Bogota"}));
  return new Date(
    colombianDate.getFullYear(),
    colombianDate.getMonth(),
    colombianDate.getDate(),
    0, 0, 0, 0 // Medianoche
  );
};

/**
 * Crea el fin del día en zona horaria de Colombia
 */
export const getColombianEndOfDay = (date: Date): Date => {
  const startOfDay = getColombianStartOfDay(date);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(startOfDay.getDate() + 1);
  return endOfDay;
};