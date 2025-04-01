import { Test, TestingModule } from '@nestjs/testing';
import { OperationInChargeService } from './in-charged.service';

describe('InChargedService', () => {
  let service: OperationInChargeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OperationInChargeService],
    }).compile();

    service = module.get<OperationInChargeService>(OperationInChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
