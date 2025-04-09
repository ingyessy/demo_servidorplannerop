import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { LoginService } from './login.service';
import { CreateLoginDto } from './dto/create-login.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Public } from 'src/auth/decorators/public.decorator';
import {Throttle, ThrottlerGuard } from '@nestjs/throttler';


@ApiTags('login')
@Controller('login')
@UseGuards(ThrottlerGuard) // Protege todas las rutas de este controlador
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) 
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() createLoginDto: CreateLoginDto) {
    const response = await this.loginService.login(createLoginDto);
    if (response === 'Invalid credentials') {
     throw new UnauthorizedException(response);
    }
    return response;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Logout exitoso' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  async logout(@Request() req) {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    return this.loginService.logout(token);
  }
}