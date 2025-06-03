import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  NotFoundException,
  UseGuards,
  ConflictException,
  Query,
} from '@nestjs/common';
import { ClientProgrammingService } from './client-programming.service';
import { CreateClientProgrammingDto } from './dto/create-client-programming.dto';
import { UpdateClientProgrammingDto } from './dto/update-client-programming.dto';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilterClientProgrammingDto } from './dto/filter-client-programming.dto';

@Controller('client-programming')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ClientProgrammingController {
  constructor(
    private readonly clientProgrammingService: ClientProgrammingService,
  ) {}

  @Post()
  @UsePipes(new DateTransformPipe())
  async create(
    @Body() createClientProgrammingDto: CreateClientProgrammingDto,
    @CurrentUser('userId') userId: number,
  ) {
    createClientProgrammingDto.id_user = userId;
    const response = await this.clientProgrammingService.create(
      createClientProgrammingDto,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    } else if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    }
    return response;
  }

  @Get('filtered')
  @UsePipes(new DateTransformPipe())
  @ApiOperation({ summary: 'Obtener programaciones de cliente con filtros' })
  async findAllFiltered(@Query() filters: FilterClientProgrammingDto) {
    const response =
      await this.clientProgrammingService.findAllFiltered(filters);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll() {
    const response = await this.clientProgrammingService.findAll();
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.clientProgrammingService.findOne(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  @UsePipes(new DateTransformPipe())
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientProgrammingDto: UpdateClientProgrammingDto,
  ) {
    const response = await this.clientProgrammingService.update(
      id,
      updateClientProgrammingDto,
    );
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.clientProgrammingService.remove(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
}
