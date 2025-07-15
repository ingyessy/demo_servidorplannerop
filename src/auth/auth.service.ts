import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/user/user.service';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Servicio para gestionar la autenticación de usuarios
 * @class AuthService
 */
@Injectable()
export class AuthService {
  constructor(
    private user: UserService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * validar usuario
   * @param username usuario para validar
   * @param password contraseña para validar
   * @returns resultado de la operación
   */
  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.user.findByUsername(username);
    if (!user) {
      return null;
    }

    if (user.status === 'INACTIVE') {
      return null;
    }
    if (user && (await this.comparePassword(password, user.password))) {
      // Excluir contraseña de la respuesta
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * generar token
   * @param user
   * @returns
   */
  generateToken(user: any) {
    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      dni: user.dni,
      occupation: user.occupation,
      phone: user.phone,
      status: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * comparar contraseña
   * @param plainPassword contraseña sin hashear
   * @param hashedPassword contraseña hasheada
   * @returns resultado de la operación
   */
  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      // Para usuarios existentes (sin hash) - Implementación temporal
      if (plainPassword === hashedPassword) {
        return true;
      }

      // Para contraseñas hasheadas
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  /**
   * hashear contraseña
   * @param password
   * @returns
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
  /**
   * decodificar token
   * @param token token a decodificar
   * @returns resultado de la operación
   */
  decodeToken(token: string) {
    try {
      // Eliminar 'Bearer ' si está presente
      const tokenValue = token.replace('Bearer ', '');
      // Decodificar el token
      const decodedToken = this.jwtService.decode(tokenValue);
      return {
        decoded: decodedToken,
        valid: !!decodedToken,
      };
    } catch (error) {
      return {
        decoded: null,
        valid: false,
        error: error.message,
      };
    }
  }
  /**
   * invalidar token
   * @param token  Token a invalidar
   * @returns resultado de la operación
   */
  async invalidateToken(token: string) {
    try {
      // Decodificar token para obtener su tiempo de expiración
      const decoded = this.jwtService.decode(token) as { exp: number };

      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Calcular tiempo restante de validez
      const expiration = decoded.exp * 1000; // Convertir a milisegundos
      const now = Date.now();
      const ttl = Math.floor((expiration - now) / 1000); // Segundos hasta expiración

      if (ttl > 0) {
        // Añadir token a lista negra hasta su expiración natural
        await this.cacheManager.set(`blacklist:${token}`, true, ttl);
      }

      return true;
    } catch (error) {
      console.error('Error invalidating token:', error);
      return false;
    }
  }
  /**
   * añadir token a lista negra
   * @param token  - Token a añadir a la lista negra
   * @returns  - Éxito de la operación
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return !!(await this.cacheManager.get(`blacklist:${token}`));
  }

  /**
   * Extrae el ID de usuario desde el token JWT
   * @param token Token JWT con el prefijo 'Bearer '
   * @returns ID del usuario o null si no se puede extraer
   */
  extractUserIdFromToken(token: string): number | null {
    try {
      // Usar el método decodeToken existente en AuthService
      const decodedResult = this.decodeToken(token);

      if (decodedResult.valid && decodedResult.decoded?.id) {
        return decodedResult.decoded.id;
      }
      return null;
    } catch (error) {
      console.error('Error extracting user ID from token:', error);
      return null;
    }
  }

  /**
   * Obtiene el tiempo restante de validez de un token en segundos
   * @param token Token JWT
   * @returns Tiempo en segundos hasta expiración (0 si ya expiró)
   */
  async getTokenExpirationTime(token: string): Promise<number> {
    try {
      const decodedToken = this.jwtService.decode(token) as { exp: number };
      const statusUser = this.decodeToken(token);
      const user = await this.user.findOneById(statusUser.decoded.id);

      if (user.status === 'INACTIVE') {
        return 0; // Si el usuario está inactivo, retornar 0
      }

      if (!decodedToken || !decodedToken.exp) {
        return 0;
      }

   

      const expirationTime = decodedToken.exp * 1000; // Convertir a milisegundos
      const currentTime = Date.now();

      // Si ya expiró, retornar 0
      if (expirationTime <= currentTime) {
        return 0;
      }

      // Retornar tiempo restante en segundos
      return Math.floor((expirationTime - currentTime) / 1000);
    } catch (error) {
      console.error('Error getting token expiration time:', error);
      return 0;
    }
  }
}
