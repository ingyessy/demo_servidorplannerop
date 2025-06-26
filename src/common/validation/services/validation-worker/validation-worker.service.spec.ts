import { Test, TestingModule } from '@nestjs/testing';
import { ValidationWorkerService } from './validation-worker.service';

describe('ValidationWorkerService', () => {
  let service: ValidationWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationWorkerService],
    }).compile();

    service = module.get<ValidationWorkerService>(ValidationWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
