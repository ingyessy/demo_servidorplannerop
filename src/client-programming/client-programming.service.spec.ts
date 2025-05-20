import { Test, TestingModule } from '@nestjs/testing';
import { ClientProgrammingService } from './client-programming.service';

describe('ClientProgrammingService', () => {
  let service: ClientProgrammingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientProgrammingService],
    }).compile();

    service = module.get<ClientProgrammingService>(ClientProgrammingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
