import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { AreaService } from './area.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('area')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.SUPERVISOR, Role.ADMIN)
@ApiBearerAuth('access-token')
@UseInterceptors(SiteInterceptor)
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  async create(
    @Body() createAreaDto: CreateAreaDto,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('subsiteId') subsiteId: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('isSupervisor') isSupervisor: boolean,
    @CurrentUser('userId') userId: number,
  ) {
    createAreaDto.id_user = userId;
    if (!isSuperAdmin) {
      if (createAreaDto.id_site !== siteId) {
        throw new ForbiddenException(
          'You do not have permission to create an area in this site',
        );
      }
      if (isSupervisor && createAreaDto.id_subsite !== subsiteId) {
        throw new ForbiddenException(
          'You do not have permission to create an area in this subsite',
        );
      }
    }

    const response = await this.areaService.create(createAreaDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
 async findAll(
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.areaService.findAll(!isSuperAdmin ? siteId : undefined);
    return response;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.areaService.findOne(id, !isSuperAdmin ? siteId : undefined);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAreaDto: UpdateAreaDto,
    @CurrentUser('userId') userId: number,
  ) {
    updateAreaDto.id_user = userId;
    const response = await this.areaService.update(id, updateAreaDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 403) {
      throw new ForbiddenException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') siteId: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
  ) {
    const response = await this.areaService.remove(
      id,
      isSuperAdmin ? undefined : siteId,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 403) {
      throw new ForbiddenException(response['message']);
    }
    return response;
  }
}
