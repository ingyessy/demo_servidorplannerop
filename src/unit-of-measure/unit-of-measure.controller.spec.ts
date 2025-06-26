import { Test, TestingModule } from '@nestjs/testing';
import { UnitOfMeasureController } from './unit-of-measure.controller';
import { UnitOfMeasureService } from './unit-of-measure.service';

describe('UnitOfMeasureController', () => {
  let controller: UnitOfMeasureController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnitOfMeasureController],
      providers: [UnitOfMeasureService],
    }).compile();

    controller = module.get<UnitOfMeasureController>(UnitOfMeasureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
