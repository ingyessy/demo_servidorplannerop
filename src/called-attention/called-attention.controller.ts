import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CalledAttentionService } from './called-attention.service';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('called-attention')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CalledAttentionController {
  constructor(
    private readonly calledAttentionService: CalledAttentionService,
  ) {}

  @Post()
  async create(
    @Body() createCalledAttentionDto: CreateCalledAttentionDto,
    @CurrentUser('userId') userId: number,
  ) {
    createCalledAttentionDto.id_user = userId;
    const response = await this.calledAttentionService.create(
      createCalledAttentionDto,
    );
    if (response['status'] === 409) {
      throw new ConflictException(response['message']);
    } else if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }else if (response['status'] === 400) {
      throw new BadRequestException(response['message']);
    }
    return response;
  }

  @Get()
  async findAll() {
    const response = await this.calledAttentionService.findAll();
    return response;
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const response = await this.calledAttentionService.findOne(id);
    return response;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCalledAttentionDto: UpdateCalledAttentionDto,
    @CurrentUser('userId') userId: number,
  ) {
    updateCalledAttentionDto.id_user = userId;
    const response = await this.calledAttentionService.update(
      id,
      updateCalledAttentionDto,
    );
    return response;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const response = await this.calledAttentionService.remove(id);
    return response;
  }
}
