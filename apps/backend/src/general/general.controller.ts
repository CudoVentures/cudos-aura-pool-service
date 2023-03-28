import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountType } from '../account/account.types';
import ApiKeyGuard from '../auth/guards/api-key.guard';
import RoleGuard from '../auth/guards/role.guard';
import { TransactionInterceptor } from '../common/common.interceptors';
import { AppRequest } from '../common/commont.types';
import { ReqCreditSettings, ReqUpdateLastCheckedBlockRequest, ReqUpdateLastCheckedPaymentRelayerBlocksRequest } from './dto/requests.dto';
import { ResCreditSettings, ResFetchLastCheckedPaymenrRelayerBlocks, ResFetchSettings } from './dto/responses.dto';
import SettingsEntity from './entities/settings.entity';
import GeneralService from './general.service';

@ApiTags('GENERAL')
@Controller('general')
export class GeneralController {
    constructor(private generalService: GeneralService) {}

    @Get('heartbeat')
    @HttpCode(200)
    @UseGuards(ApiKeyGuard)
    async getAlive(): Promise<string> {
        return 'running';
    }

    @Get('last-checked-block')
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    @UseGuards(ApiKeyGuard)
    async getLastCheckedBlock(
        @Req() req: AppRequest,
    ): Promise<{height: number}> {
        const height = await this.generalService.getLastCheckedBlock(req.transaction);
        return { height: height === 0 ? parseInt(process.env.APP_CUDOS_INIT_BLOCK) : height };
    }

    @Put('last-checked-block')
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    @UseGuards(ApiKeyGuard)
    async updateLastCheckedBlock(
        @Req() req: AppRequest,
        @Body() reqUpdateLastCheckedBlockRequest: ReqUpdateLastCheckedBlockRequest,
    ): Promise<any> {
        return this.generalService.setLastCheckedBlock(reqUpdateLastCheckedBlockRequest.height, req.transaction);
    }

    @Get('last-checked-payment-relayer-blocks')
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    @UseGuards(ApiKeyGuard)
    async getLastCheckedPaymentRelayerBlock(
        @Req() req: AppRequest,
    ): Promise<ResFetchLastCheckedPaymenrRelayerBlocks> {
        const generalEntity = await this.generalService.fetchGeneral(req.transaction);

        const res = new ResFetchLastCheckedPaymenrRelayerBlocks(generalEntity.lastCheckedPaymentRelayerEthBlock, generalEntity.lastCheckedPaymentRelayerCudosBlock);

        return res;
    }

    @Put('last-checked-payment-relayer-blocks')
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    @UseGuards(ApiKeyGuard)
    async updateLastCheckedPaymentRelayerBlock(
        @Req() req: AppRequest,
        @Body() reqUpdateLastCheckedBlockRequest: ReqUpdateLastCheckedPaymentRelayerBlocksRequest,
    ): Promise<any> {
        return this.generalService.setLastCheckedPaymentRelayerBlocks(reqUpdateLastCheckedBlockRequest.lastCheckedEthBlock, reqUpdateLastCheckedBlockRequest.lastCheckedCudosBlock, req.transaction);
    }

    @Get('fetchSettings')
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    async fetchSettings(
        @Req() req: AppRequest,
    ): Promise < ResFetchSettings > {
        const settingsEntity = await this.generalService.fetchSettings(req.transaction);
        return new ResFetchSettings(settingsEntity);
    }

    @Post('creditSettings')
    @UseGuards(RoleGuard([AccountType.SUPER_ADMIN]))
    @UseInterceptors(TransactionInterceptor)
    @HttpCode(200)
    async creditSettings(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqCreditSettings: ReqCreditSettings,
    ): Promise < ResCreditSettings > {
        let settingsEntity = SettingsEntity.fromJson(reqCreditSettings.settingsEntity);
        if (settingsEntity.hasValidRoyaltiesPrecision() === false) {
            throw new Error('Max 2 decimal numbers');
        }

        settingsEntity = await this.generalService.creditSettings(settingsEntity, req.transaction);
        return new ResCreditSettings(settingsEntity);
    }
}
