import { Test, TestingModule } from '@nestjs/testing';
import { InabilityController } from './inability.controller';
import { InabilityService } from './inability.service';

describe('InabilityController', () => {
  let controller: InabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InabilityController],
      providers: [InabilityService],
    }).compile();

    controller = module.get<InabilityController>(InabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
