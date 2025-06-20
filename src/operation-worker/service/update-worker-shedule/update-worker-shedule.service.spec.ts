import { Test, TestingModule } from '@nestjs/testing';
import { UpdateWorkerSheduleService } from './update-worker-shedule.service';

describe('UpdateWorkerSheduleService', () => {
  let service: UpdateWorkerSheduleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateWorkerSheduleService],
    }).compile();

    service = module.get<UpdateWorkerSheduleService>(UpdateWorkerSheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
