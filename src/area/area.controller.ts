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

@Controller('area')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@UseInterceptors(SiteInterceptor)
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  async create(
    @Body() createAreaDto: CreateAreaDto,
    @CurrentUser('userId') userId: number,
  ) {
    createAreaDto.id_user = userId;
    const response = await this.areaService.create(createAreaDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  findAll() {
    return this.areaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.areaService.findOne(id);
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
    const response = await this.areaService.remove(id, isSuperAdmin ? undefined : siteId);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 403) {
      throw new ForbiddenException(response['message']);
    }
    return response;
  }
}
