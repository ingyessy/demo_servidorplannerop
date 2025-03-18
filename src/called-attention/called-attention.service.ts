import { Injectable } from '@nestjs/common';
import { CreateCalledAttentionDto } from './dto/create-called-attention.dto';
import { UpdateCalledAttentionDto } from './dto/update-called-attention.dto';

@Injectable()
export class CalledAttentionService {
  create(createCalledAttentionDto: CreateCalledAttentionDto) {
    return 'This action adds a new calledAttention';
  }

  findAll() {
    return `This action returns all calledAttention`;
  }

  findOne(id: number) {
    return `This action returns a #${id} calledAttention`;
  }

  update(id: number, updateCalledAttentionDto: UpdateCalledAttentionDto) {
    return `This action updates a #${id} calledAttention`;
  }

  remove(id: number) {
    return `This action removes a #${id} calledAttention`;
  }
}
