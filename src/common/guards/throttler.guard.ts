// import { Injectable } from '@nestjs/common';
// import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
// import { ExecutionContext } from '@nestjs/common';

// @Injectable()
// export class CustomThrottlerGuard extends ThrottlerGuard {
//   async handleRequest(
//     requestProps: ThrottlerRequest
//   ): Promise<boolean> {
//     // Obtener la solicitud
//     const request = requestProps.context.switchToHttp().getRequest();
//     const ip = request.ip;
    
//     // Registrar intentos de acceso sospechosos (opcional)
//     if (this.isOverLimit(request)) {
//       console.warn(`Posible ataque DDoS detectado desde IP: ${ip}`);
//     }
    
//     return super.handleRequest(requestProps);
//   }
  
//   protected isOverLimit(request: any): boolean {
//     // Lógica personalizada para detectar patrones sospechosos
//     // Esta es una implementación básica que podrías mejorar
//     const tracker = request.throttlerTracker;
//     if (!tracker) return false;
    
//     // Si el cliente ha hecho más del 90% de las solicitudes permitidas
//     return tracker.currentCount > (tracker.limit * 0.9);
//   }
// }