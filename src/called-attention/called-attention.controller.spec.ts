import { Test, TestingModule } from '@nestjs/testing';
import { CalledAttentionController } from './called-attention.controller';
import { CalledAttentionService } from './called-attention.service';

describe('CalledAttentionController', () => {
  let controller: CalledAttentionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalledAttentionController],
      providers: [CalledAttentionService],
    }).compile();

    controller = module.get<CalledAttentionController>(CalledAttentionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
