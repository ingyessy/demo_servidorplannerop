import { Test, TestingModule } from '@nestjs/testing';
import { FeedingService } from './feeding.service';

describe('FeedingService', () => {
  let service: FeedingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedingService],
    }).compile();

    service = module.get<FeedingService>(FeedingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
