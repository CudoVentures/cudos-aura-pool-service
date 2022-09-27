import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import RoleGuard from '../auth/guards/role.guard';
import { Role } from '../user/roles';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { Farm } from './farm.model';
import { FarmService } from './farm.service';
import { IsOwnerGuard } from './guards/is-owner.guard';

@Controller('farm')
export class FarmController {
  constructor(private farmService: FarmService) {}

  @Get()
  async findAll(): Promise<Farm[]> {
    return this.farmService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Farm> {
    return this.farmService.findOne(id);
  }

  @UseGuards(RoleGuard([Role.FARM_ADMIN]))
  @Post()
  async create(
    @Request() req,
    @Body() createFarmDto: CreateFarmDto,
  ): Promise<Farm> {
    const farm = await this.farmService.createOne(createFarmDto, req.user.id);

    return farm;
  }

  @UseGuards(RoleGuard([Role.FARM_ADMIN, Role.SUPER_ADMIN]), IsOwnerGuard)
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFarmDto: UpdateFarmDto,
  ): Promise<string> {
    return 'This is accesable';
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<string> {
    return 'This is accesable';
  }
}
