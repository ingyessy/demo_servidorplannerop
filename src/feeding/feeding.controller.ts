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
} from '@nestjs/common';
import { FeedingService } from './feeding.service';
import { CreateFeedingDto } from './dto/create-feeding.dto';
import { UpdateFeedingDto } from './dto/update-feeding.dto';
import { DateTransformPipe } from 'src/pipes/date-transform/date-transform.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('feeding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FeedingController {
  constructor(private readonly feedingService: FeedingService) {}

  @Post()
  @UsePipes(DateTransformPipe)
  async create(@Body() createFeedingDto: CreateFeedingDto) {
    const response = await this.feedingService.create(createFeedingDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll() {
    const response = await this.feedingService.findAll();
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.feedingService.findOne(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
  @Get('operation/:id')
  async findByOperation(@Param('id', ParseIntPipe) id: number) {
    const response = await this.feedingService.findByOperation(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateFeedingDto: UpdateFeedingDto) {
    return this.feedingService.update(id, updateFeedingDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.feedingService.remove(id);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }
}
