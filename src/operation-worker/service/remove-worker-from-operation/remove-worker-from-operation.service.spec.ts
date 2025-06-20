import { Test, TestingModule } from '@nestjs/testing';
import { RemoveWorkerFromOperationService } from './remove-worker-from-operation.service';

describe('RemoveWorkerFromOperationService', () => {
  let service: RemoveWorkerFromOperationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RemoveWorkerFromOperationService],
    }).compile();

    service = module.get<RemoveWorkerFromOperationService>(RemoveWorkerFromOperationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
