import { Test, TestingModule } from '@nestjs/testing';
import { SubsiteService } from './subsite.service';

describe('SubsiteService', () => {
  let service: SubsiteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubsiteService],
    }).compile();

    service = module.get<SubsiteService>(SubsiteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
