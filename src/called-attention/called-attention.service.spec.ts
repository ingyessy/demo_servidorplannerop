import { Test, TestingModule } from '@nestjs/testing';
import { CalledAttentionService } from './called-attention.service';

describe('CalledAttentionService', () => {
  let service: CalledAttentionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalledAttentionService],
    }).compile();

    service = module.get<CalledAttentionService>(CalledAttentionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
