import { Test, TestingModule } from '@nestjs/testing';
import { ValidationTaskAndSubtaskService } from './validation-task-and-subtask.service';

describe('ValidationTaskAndSubtaskService', () => {
  let service: ValidationTaskAndSubtaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationTaskAndSubtaskService],
    }).compile();

    service = module.get<ValidationTaskAndSubtaskService>(ValidationTaskAndSubtaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
