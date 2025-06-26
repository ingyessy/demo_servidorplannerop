import { Test, TestingModule } from '@nestjs/testing';
import { SubsiteController } from './subsite.controller';
import { SubsiteService } from './subsite.service';

describe('SubsiteController', () => {
  let controller: SubsiteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubsiteController],
      providers: [SubsiteService],
    }).compile();

    controller = module.get<SubsiteController>(SubsiteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
