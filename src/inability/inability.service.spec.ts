import { Test, TestingModule } from '@nestjs/testing';
import { InabilityService } from './inability.service';

describe('InabilityService', () => {
  let service: InabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InabilityService],
    }).compile();

    service = module.get<InabilityService>(InabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
