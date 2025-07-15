import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Pipe para transformar strings a valores booleanos
 * Es especialmente útil para parámetros de consulta (query parameters)
 */
@Injectable()
export class BooleanTransformPipe implements PipeTransform {
  /**
   * Transforma cadenas de texto a booleanos
   * @param value - Valor a transformar
   * @param metadata - Metadatos del argumento
   * @returns Valor transformado a booleano
   * 
   * Valores que se convierten a true: 'true', '1', 'yes'
   * Valores que se convierten a false: 'false', '0', 'no'
   * El valor por defecto se puede especificar en el constructor
   */
  constructor(private readonly defaultValue: boolean = true) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // Si el valor ya es booleano, devolverlo tal cual
    if (typeof value === 'boolean') {
      return value;
    }
    
    // Si el valor es undefined o null, devolver el valor por defecto
    if (value === undefined || value === null) {
      return this.defaultValue;
    }
    
    // Si el valor es un string, convertirlo a booleano
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      
      // Valores que se consideran falsos
      if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      }
      
      // Valores que se consideran verdaderos
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      }
    }
    
    // Para cualquier otro valor, devolver el valor por defecto
    return this.defaultValue;
  }
}