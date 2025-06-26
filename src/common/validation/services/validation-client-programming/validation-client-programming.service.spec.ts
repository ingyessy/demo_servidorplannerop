import { Test, TestingModule } from '@nestjs/testing';
import { ValidationClientProgrammingService } from './validation-client-programming.service';

describe('ValidationClientProgrammingService', () => {
  let service: ValidationClientProgrammingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationClientProgrammingService],
    }).compile();

    service = module.get<ValidationClientProgrammingService>(ValidationClientProgrammingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
