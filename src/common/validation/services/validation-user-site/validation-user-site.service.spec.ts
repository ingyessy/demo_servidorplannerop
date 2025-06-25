import { Test, TestingModule } from '@nestjs/testing';
import { ValidationUserSiteService } from './validation-user-site.service';

describe('ValidationUserSiteService', () => {
  let service: ValidationUserSiteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationUserSiteService],
    }).compile();

    service = module.get<ValidationUserSiteService>(ValidationUserSiteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
