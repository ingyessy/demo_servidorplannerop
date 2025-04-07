import { Test, TestingModule } from '@nestjs/testing';
import { OperationController } from 'src/operation/operation.controller';
import { OperationInChargeService } from './in-charged.service';

describe('InChargedController', () => {
  let controller: OperationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationController],
      providers: [OperationInChargeService],
    }).compile();

    controller = module.get<OperationController>(OperationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
