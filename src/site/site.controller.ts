import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ConflictException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('site')
@ApiBearerAuth('access-token')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  async create(
    @Request() req,
    @Body() createSiteDto: CreateSiteDto,
    @CurrentUser('userId') userId: number,
  ) {
    const currentUserRole = req.user.role;
    if (currentUserRole !== Role.SUPERADMIN) {
      throw new ConflictException('Only superadmin can create sites');
    }
    createSiteDto.id_user = userId;
    const response = await this.siteService.create(createSiteDto);
    if (response.status === 409) {
      throw new ConflictException(response.message);
    }
    return response;
  }

  @Get()
  findAll() {
    return this.siteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.siteService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSiteDto: UpdateSiteDto,
  ) {
    return this.siteService.update(id, updateSiteDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.siteService.remove(id);
  }
}
