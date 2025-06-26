import { Test, TestingModule } from '@nestjs/testing';
import { AssignWorkerToOperationService } from './assign-worker-to-operation.service';

describe('AssignWorkerToOperationService', () => {
  let service: AssignWorkerToOperationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssignWorkerToOperationService],
    }).compile();

    service = module.get<AssignWorkerToOperationService>(AssignWorkerToOperationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
