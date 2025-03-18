import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CalledAttentionService } from './called-attention.service';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';

@Controller('called-attention')
export class CalledAttentionController {
  constructor(private readonly calledAttentionService: CalledAttentionService) {}

  @Post()
  create(@Body() createCalledAttentionDto: CreateCalledAttentionDto) {
    return this.calledAttentionService.create(createCalledAttentionDto);
  }

  @Get()
  findAll() {
    return this.calledAttentionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.calledAttentionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCalledAttentionDto: UpdateCalledAttentionDto) {
    return this.calledAttentionService.update(+id, updateCalledAttentionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.calledAttentionService.remove(+id);
  }
}
