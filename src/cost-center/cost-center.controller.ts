import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CostCenterService } from './cost-center.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('cost-center')
@ApiBearerAuth('access-token')
@UseInterceptors(SiteInterceptor)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.ADMIN)
export class CostCenterController {
  constructor(private readonly costCenterService: CostCenterService) {}

  @Post()
  async create(
    @Body() createCostCenterDto: CreateCostCenterDto,
    @CurrentUser('userId') id_user: number,
    @CurrentUser('siteId') id_site: number,
  ) {
    createCostCenterDto.id_user = id_user;
    createCostCenterDto.id_site = id_site;
    const response = await this.costCenterService.create(createCostCenterDto);
    if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll(@CurrentUser('siteId') id_site: number) {
    const response = await this.costCenterService.findAll(id_site);
    if (response['status'] === 404) {
      throw new NotFoundException('No cost centers found');
    }
    return response;
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') id_site: number,
  ) {
    const response = await this.costCenterService.findOne(id, id_site);
    if (response['status'] === 404) {
      throw new NotFoundException('Cost center not found');
    }
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCostCenterDto: UpdateCostCenterDto,
  ) {
    const response = await this.costCenterService.update(
      id,
      updateCostCenterDto,
    );
    if (response['status'] === 404) {
      throw new NotFoundException('Cost center not found');
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.costCenterService.remove(id);
    if (response['status'] === 404) {
      throw new NotFoundException('Cost center not found');
    }
    return response;
  }
}
