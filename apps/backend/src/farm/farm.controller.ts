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
    HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import RoleGuard from '../auth/guards/role.guard';
import { FarmService } from './farm.service';
import { IsCreatorOrSuperAdminGuard } from './guards/is-creator-or-super-admin.guard';
import MiningFarmFilterModel from './dto/farm-filter.model';
import { AppRequest } from '../common/commont.types';
import { TransactionInterceptor } from '../common/common.interceptors';
import { AccountType } from '../account/account.types';
import { ReqCreditEnergySource, ReqCreditManufacturer, ReqCreditMiner, ReqCreditMiningFarm, ReqFetchBestPerformingMiningFarms, ReqFetchMiningFarmDetails } from './dto/requests.dto';
import MiningFarmEntity from './entities/mining-farm.entity';
import { ResCreditEnergySource, ResCreditManufacturer, ResCreditMiner, ResCreditMiningFarm, ResFetchBestPerformingMiningFarms, ResFetchEnergySources, ResFetchManufacturers, ResFetchMiners, ResFetchMiningFarmDetails, ResFetchMiningFarmsByFilter } from './dto/responses.dto';
import { FarmStatus } from './farm.types';
import EnergySourceEntity from './entities/energy-source.entity';
import MinerEntity from './entities/miner.entity';
import ManufacturerEntity from './entities/manufacturer.entity';

@ApiTags('Farm')
@Controller('farm')
export class FarmController {
    constructor(
        private miningFarmService: FarmService,
    // eslint-disable-next-line no-empty-function
    ) { }

    @Post()
    @HttpCode(200)
    async fetchMiningFarmsByFilter(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) miningFarmFilterModel: MiningFarmFilterModel,
    ): Promise < ResFetchMiningFarmsByFilter > {
        const { miningFarmEntities, total } = await this.miningFarmService.findByFilter(req.sessionAccountEntity, miningFarmFilterModel);
        return new ResFetchMiningFarmsByFilter(miningFarmEntities, total);
    }

    @Post('fetchBestPerformingMiningFarm')
    @HttpCode(200)
    async fetchBestPerformingMiningFarm(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqFetchBestPerformingMiningFarm: ReqFetchBestPerformingMiningFarms,
    ): Promise < ResFetchBestPerformingMiningFarms > {
        const miningFarmEntities = await this.miningFarmService.findBestPerformingMiningFarms(reqFetchBestPerformingMiningFarm.timestampFrom, reqFetchBestPerformingMiningFarm.timestampTo);
        return new ResFetchBestPerformingMiningFarms(miningFarmEntities);
    }

    @Post('fetchMiningFarmsDetailsByIds')
    @HttpCode(200)
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
    @HttpCode(200)
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
    @HttpCode(200)
    async findMiners(): Promise < ResFetchMiners > {
        const minerEntities = await this.miningFarmService.findMiners();
        return new ResFetchMiners(minerEntities);
    }

    @Get('energy-sources')
    @HttpCode(200)
    async findEnergySources(): Promise < ResFetchEnergySources > {
        const energySourceEntities = await this.miningFarmService.findEnergySources();
        return new ResFetchEnergySources(energySourceEntities);
    }

    @Get('manufacturers')
    @HttpCode(200)
    async findManufacturers(): Promise < ResFetchManufacturers > {
        const manufacturerEntities = await this.miningFarmService.findManufacturers();
        return new ResFetchManufacturers(manufacturerEntities);
    }

    @UseInterceptors(TransactionInterceptor)
    @Put('miners')
    @HttpCode(200)
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
    @HttpCode(200)
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
    @HttpCode(200)
    async creditManufacturers(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditManufacturer: ReqCreditManufacturer,
    ): Promise < ResCreditManufacturer > {
        let manufacturerEntity = ManufacturerEntity.fromJson(reqCreditManufacturer.manufacturerEntity);
        manufacturerEntity = await this.miningFarmService.creditManufacturer(manufacturerEntity, req.transaction);
        return new ResCreditManufacturer(manufacturerEntity);
    }
}
