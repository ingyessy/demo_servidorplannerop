import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientEmailService } from './client-email.service';
import { CreateClientEmailDto } from './dto/create-client-email.dto';
import { UpdateClientEmailDto } from './dto/update-client-email.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('client-email')
@ApiBearerAuth('access-token')
@Controller('client-email')
export class ClientEmailController {
  constructor(private readonly clientEmailService: ClientEmailService) {}

 @Post()
  create(@Body() dto: CreateClientEmailDto) {
    return this.clientEmailService.create(dto);
  }

  @Get('client/:idClient')
  findByClient(@Param('idClient', ParseIntPipe) idClient: number) {
    return this.clientEmailService.findByClient(idClient);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientEmailService.findOne(id);
  }

    @Get()
    @Roles(Role.SUPERVISOR,Role.PROGRAMMER, Role.ADMIN, Role.SUPERADMIN)
    async findAll() {
      const response = await this.clientEmailService.findAll();
      return response;
    }
  

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientEmailDto,
  ) {
    return this.clientEmailService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientEmailService.remove(id);
  }
}
