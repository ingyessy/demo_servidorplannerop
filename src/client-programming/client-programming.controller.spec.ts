import { Test, TestingModule } from '@nestjs/testing';
import { ClientProgrammingController } from './client-programming.controller';
import { ClientProgrammingService } from './client-programming.service';

describe('ClientProgrammingController', () => {
  let controller: ClientProgrammingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientProgrammingController],
      providers: [ClientProgrammingService],
    }).compile();

    controller = module.get<ClientProgrammingController>(ClientProgrammingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
