import { Test, TestingModule } from '@nestjs/testing';
import { OperationWorkerController } from './operation-worker.controller';
import { OperationWorkerService } from './operation-worker.service';

describe('OperationWorkerController', () => {
  let controller: OperationWorkerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationWorkerController],
      providers: [OperationWorkerService],
    }).compile();

    controller = module.get<OperationWorkerController>(OperationWorkerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
