import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { BillService } from './bill.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SiteInterceptor } from 'src/common/interceptors/site.interceptor';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ParseIntPipe } from 'src/pipes/parse-int/parse-int.pipe';

@Controller('bill')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SiteInterceptor)
@Roles(Role.SUPERADMIN, Role.ADMIN)
@ApiBearerAuth('access-token')
export class BillController {
  constructor(private readonly billService: BillService) {}

  @Post()
  async create(@Body() createBillDto: CreateBillDto) {
    const response = await this.billService.create(createBillDto);
    if (response['status'] === 404) {
      throw new NotFoundException(response['message']);
    }
    return response;
  }

  @Get()
  findAll() {
    return this.billService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.billService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBillDto: UpdateBillDto,
  ) {
    return this.billService.update(id, updateBillDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billService.remove(id);
  }
}
