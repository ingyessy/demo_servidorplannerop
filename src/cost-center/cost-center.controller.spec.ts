import { Test, TestingModule } from '@nestjs/testing';
import { CostCenterController } from './cost-center.controller';
import { CostCenterService } from './cost-center.service';

describe('CostCenterController', () => {
  let controller: CostCenterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CostCenterController],
      providers: [CostCenterService],
    }).compile();

    controller = module.get<CostCenterController>(CostCenterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
