import {
    Body,
    Controller,
    Get,
    Put,
    UseGuards,
    Post,
    ValidationPipe,
    Req,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import RoleGuard from '../auth/guards/role.guard';
import { FarmService } from './farm.service';
import { IsCreatorOrSuperAdminGuard } from './guards/is-creator-or-super-admin.guard';
import MiningFarmFilterModel from './dto/farm-filter.mdel';
import { AppRequest } from '../common/commont.types';
import { TransactionInterceptor } from '../common/common.interceptors';
import { AccountType } from '../account/account.types';
import { ReqCreditEnergySource, ReqCreditManufacturer, ReqCreditMiner, ReqCreditMiningFarm, ReqFetchMiningFarmDetails } from './dto/requests.dto';
import MiningFarmEntity from './entities/mining-farm.entity';
import { ResCreditEnergySource, ResCreditManufacturer, ResCreditMiner, ResCreditMiningFarm, ResFetchEnergySources, ResFetchManufacturers, ResFetchMiners, ResFetchMiningFarmDetails } from './dto/responses.dto';
import { FarmStatus } from './farm.types';
import EnergySourceEntity from './entities/energy-source.entity';
import MinerEntity from './entities/miner.entity';
import ManufacturerEntity from './entities/manufacturer.entity';

@ApiTags('Farm')
@Controller('farm')
export class FarmController {
    constructor(
        private miningFarmService: FarmService,
    ) { }

    @Post()
    async findAll(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) miningFarmFilterModel: MiningFarmFilterModel,
    ): Promise < { miningFarmEntities: MiningFarmEntity[], total: number } > {
        return this.miningFarmService.findByFilter(req.sessionAccountEntity, miningFarmFilterModel);
    }

    @Post('fetchMiningFarmsDetailsByIds')
    async fetchMiningFarmsDetailsByIds(
        @Body(new ValidationPipe({ transform: true })) reqFetchMiningFarmDetails: ReqFetchMiningFarmDetails,
    ): Promise < ResFetchMiningFarmDetails > {
        const miningFarmIds = reqFetchMiningFarmDetails.getParsedIds();
        const getMiningFarmDetailEntities = miningFarmIds.map((miningFarmId) => this.miningFarmService.getDetails(miningFarmId))
        const miningFarmDetailEntities = await Promise.all(getMiningFarmDetailEntities);
        return new ResFetchMiningFarmDetails(miningFarmDetailEntities);
    }

    @ApiBearerAuth('access-token')
    @UseGuards(RoleGuard([AccountType.ADMIN, AccountType.SUPER_ADMIN]), IsCreatorOrSuperAdminGuard)
    @UseInterceptors(TransactionInterceptor)
    @Put()
    async creditFarm(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditMiningFarm: ReqCreditMiningFarm,
    ): Promise < ResCreditMiningFarm > {
        let miningFarmEntity = MiningFarmEntity.fromJson(reqCreditMiningFarm.miningFarmEntity);
        if (req.sessionAccountEntity.isAdmin() === true) {
            miningFarmEntity.accountId = req.sessionAccountEntity.accountId;
            miningFarmEntity.status = FarmStatus.QUEUED;
        }

        miningFarmEntity = await this.miningFarmService.creditMiningFarm(miningFarmEntity, req.sessionAccountEntity !== null, req.transaction);

        return new ResCreditMiningFarm(miningFarmEntity);
    }

    @Get('miners')
    async findMiners(): Promise < ResFetchMiners > {
        const minerEntities = await this.miningFarmService.findMiners();
        return new ResFetchMiners(minerEntities);
    }

    @Get('energy-sources')
    async findEnergySources(): Promise < ResFetchEnergySources > {
        const energySourceEntities = await this.miningFarmService.findEnergySources();
        return new ResFetchEnergySources(energySourceEntities);
    }

    @Get('manufacturers')
    async findManufacturers(): Promise < ResFetchManufacturers > {
        const manufacturerEntities = await this.miningFarmService.findManufacturers();
        return new ResFetchManufacturers(manufacturerEntities);
    }

    @UseInterceptors(TransactionInterceptor)
    @Put('miners')
    async creditMiners(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditMiner: ReqCreditMiner,
    ): Promise < ResCreditMiner > {
        let minerEntity = MinerEntity.fromJson(reqCreditMiner.minerEntity);
        minerEntity = await this.miningFarmService.creditMiner(minerEntity, req.transaction);
        return new ResCreditMiner(minerEntity);
    }

    @UseInterceptors(TransactionInterceptor)
    @Put('energy-sources')
    async creditEnergySources(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditEnergySource: ReqCreditEnergySource,
    ): Promise < ResCreditEnergySource > {
        let energySourceEntity = EnergySourceEntity.fromJson(reqCreditEnergySource.energySourceEntity);
        energySourceEntity = await this.miningFarmService.creditEnergySource(energySourceEntity, req.transaction);
        return new ResCreditEnergySource(energySourceEntity);
    }

    @UseInterceptors(TransactionInterceptor)
    @Put('manufacturers')
    async creditManufacturers(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditManufacturer: ReqCreditManufacturer,
    ): Promise < ResCreditManufacturer > {
        let manufacturerEntity = ManufacturerEntity.fromJson(reqCreditManufacturer.manufacturerEntity);
        manufacturerEntity = await this.miningFarmService.creditManufacturer(manufacturerEntity, req.transaction);
        return new ResCreditManufacturer(manufacturerEntity);
    }
}
