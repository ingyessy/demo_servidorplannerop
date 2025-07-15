import { Test, TestingModule } from '@nestjs/testing';
import { FeedingController } from './feeding.controller';
import { FeedingService } from './feeding.service';

describe('FeedingController', () => {
  let controller: FeedingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedingController],
      providers: [FeedingService],
    }).compile();

    controller = module.get<FeedingController>(FeedingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
