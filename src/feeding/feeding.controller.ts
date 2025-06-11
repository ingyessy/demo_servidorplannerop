import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  UseGuards,
  NotFoundException,
  ParseIntPipe,
  Query,
  ValidationPipe,
  UseInterceptors,
  ConflictException,
} from '@nestjs/common';
import { FeedingService } from './feeding.service';
import { CreateFeedingDto } from './dto/create-feeding.dto';
import { UpdateFeedingDto } from './dto/update-feeding.dto';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaginatedWorkerFeedingQueryDto } from './dto/paginated-worker-feeding-query.dto';
import { FilterWorkerFeedingDto } from './dto/filter-worker-feeding.dto';
import { BooleanTransformPipe } from 'src/pipes/boolean-transform/boolean-transform.pipe';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('feeding')
@UseGuards(JwtAuthGuard)
@UseInterceptors(SiteInterceptor)
@ApiBearerAuth('access-token')
export class FeedingController {
  constructor(private readonly feedingService: FeedingService) {}

  @Post()
  @UsePipes(DateTransformPipe)
  async create(
    @Body() createFeedingDto: CreateFeedingDto,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.feedingService.create(
      createFeedingDto,
      isSuperAdmin ? undefined : siteId,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll(
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.feedingService.findAll(
      isSuperAdmin ? undefined : siteId,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get('paginated')
  @ApiOperation({
    summary:
      'Obtener registros de alimentación con paginación y filtros opcionales',
  })
  @ApiQuery({
    name: 'activatePaginated',
    required: false,
    type: Boolean,
    description:
      'Si es false, devuelve todos los registros sin paginación. Por defecto: true',
  })
  async findPaginated(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryParams: PaginatedWorkerFeedingQueryDto,
    @Query('activatePaginated', new BooleanTransformPipe(true))
    activatePaginated: boolean,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    try {
      // Construir el objeto de filtros
      const filters: FilterWorkerFeedingDto = {};

      if (!isSuperAdmin) {
        filters.id_site = siteId;
      }

      if (queryParams.type) {
        filters.type = queryParams.type;
      }

      if (queryParams.startDate) {
        filters.startDate = queryParams.startDate;
      }

      if (queryParams.endDate) {
        filters.endDate = queryParams.endDate;
      }

      if (queryParams.search && queryParams.search.trim() !== '') {
        filters.search = queryParams.search.trim();
      }

      // Obtener los datos paginados
      return await this.feedingService.findAllPaginated(
        queryParams.page || 1,
        queryParams.limit || 10,
        filters,
        activatePaginated,
      );
    } catch (error) {
      console.error('Error in paginated request:', error);
      throw new Error(`Error processing paginated request: ${error.message}`);
    }
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') id_site: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
  ) {
    const response = await this.feedingService.findOne(
      id,
      isSuperAdmin ? undefined : id_site,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
  @Get('operation/:id')
  async findByOperation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('siteId') id_site: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
  ) {
    const response = await this.feedingService.findByOperation(
      id,
      isSuperAdmin ? undefined : id_site,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFeedingDto: UpdateFeedingDto,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.feedingService.update(
      id,
      updateFeedingDto,
      isSuperAdmin ? undefined : siteId,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('isSuperAdmin') isSuperAdmin: boolean,
    @CurrentUser('siteId') siteId: number,
  ) {
    const response = await this.feedingService.remove(id, isSuperAdmin ? undefined : siteId);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }
}
