import { Test, TestingModule } from '@nestjs/testing';
import { OperationWorkerService } from './operation-worker.service';

describe('OperationWorkerService', () => {
  let service: OperationWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperationWorkerService],
    }).compile();

    service = module.get<OperationWorkerService>(OperationWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
