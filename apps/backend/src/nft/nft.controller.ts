import { Body, Controller, Get, Param, Post, ValidationPipe, Req, Put, UseInterceptors, HttpCode, Inject, forwardRef, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NFTService } from './nft.service';
import { GraphqlService } from '../graphql/graphql.service';
import { NftStatus } from './nft.types';
import { TransactionInterceptor } from '../common/common.interceptors';
import { AppRequest } from '../common/commont.types';
import { ReqNftsByFilter, ReqUpdateNftChainData, ReqUpdateNftCudosPrice } from './dto/requests.dto';
import NftFilterEntity from './entities/nft-filter.entity';
import { ResFetchNftsByFilter, ResUpdateNftCudosPrice } from './dto/responses.dto';
import NftEntity from './entities/nft.entity';
import { CollectionService } from '../collection/collection.service';
import BigNumber from 'bignumber.js';
import { ChainMarketplaceNftEntity } from '../graphql/entities/nft-marketplace.entity';
import { FarmService } from '../farm/farm.service';
import { validate } from 'uuid';
import RoleGuard from '../auth/guards/role.guard';
import { AccountType } from '../account/account.types';
import { IsCreatorOrSuperAdminGuard } from './guards/is-creator-or-super-admin.guard';
import { IsPresaleContractRelayerGuard } from './guards/is-presale-contract-relayer';
import { ConfigService } from '@nestjs/config';
import AccountService from '../account/account.service';

@ApiTags('NFT')
@Controller('nft')
export class NFTController {
    constructor(
        private nftService: NFTService,
        @Inject(forwardRef(() => CollectionService))
        private collectionService: CollectionService,
        private graphqlService: GraphqlService,
        @Inject(forwardRef(() => FarmService))
        private miningFarmService: FarmService,
        private configService: ConfigService,
        private accountService: AccountService,
    // eslint-disable-next-line no-empty-function
    ) {}

    @Post()
    @HttpCode(200)
    async fetchByFilter(
        @Req() req: AppRequest,
        @Body(new ValidationPipe({ transform: true })) reqNftsByFilter: ReqNftsByFilter,
    ): Promise < ResFetchNftsByFilter > {
        const nftFilterEntity = NftFilterEntity.fromJson(reqNftsByFilter.nftFilterJson);
        const { nftEntities, total } = await this.nftService.findByFilter(req.sessionUserEntity, nftFilterEntity);

        return new ResFetchNftsByFilter(nftEntities, total);
    }

    // used by on-demand-minting
    @Get('on-demand-minting-nft/:id/:recipient')
    @HttpCode(200)
    async findOne(@Param('id') id: string, @Param('recipient') recipient: string): Promise<any> {
        const userEntity = await this.accountService.findUserByCudosWalletAddress(recipient);
        if (userEntity === null) {
            throw new NotFoundException();
        }

        let nftEntity;

        if (id === 'presale') {
            const presaleEndTimestamp = this.configService.get<number>('APP_PRESALE_END_TIMESTAMP');
            if (presaleEndTimestamp < Date.now()) {
                throw new Error('Presale ended.')
            }

            nftEntity = await this.nftService.getRandomPresaleNft();
            if (nftEntity !== null) {
                nftEntity = await this.nftService.updatePremintNftPrice(nftEntity);
            }
        } else {
            nftEntity = await this.nftService.findOne(id);
        }

        if (nftEntity.isPriceInAcudosValidForMinting() === false) {
            throw new NotFoundException();
        }

        if (nftEntity.isQueued() === false) {
            throw new NotFoundException();
        }

        const collectionEntity = await this.collectionService.findOne(nftEntity.collectionId);
        if (collectionEntity === null || collectionEntity.isApproved() === false) {
            throw new NotFoundException();
        }

        const miningFarmEntity = await this.miningFarmService.findMiningFarmById(collectionEntity.farmId);
        if (miningFarmEntity === null || miningFarmEntity.isApproved() === false) {
            throw new NotFoundException();
        }

        return { ...NftEntity.toJson(nftEntity),
            denomId: collectionEntity.denomId,
            data: JSON.stringify({
                expiration_date: nftEntity.expirationDateTimestamp,
                hash_rate_owned: nftEntity.hashingPower,
            }) };
    }

    @UseInterceptors(TransactionInterceptor)
    @Put('trigger-updates')
    @HttpCode(200)
    async updateNftsChainData(
        @Req() req: AppRequest,
        @Body() reqUpdateNftChainData: ReqUpdateNftChainData,
    ): Promise<void> {
        const { nftDtos: nftDataJsons, height } = reqUpdateNftChainData;

        const bdJunoParsedHeight = await this.graphqlService.fetchLastParsedHeight();

        if (height > bdJunoParsedHeight) {
            throw new Error(`BDJuno not yet on block:  ${height}`);
        }

        const denomIds = nftDataJsons.map((nftJson) => nftJson.denomId)
            .filter((denomId, index, self) => self.indexOf(denomId) === index);

        let chainMarketplaceNftEntities: ChainMarketplaceNftEntity[] = [];
        for (let i = 0; i < denomIds.length; i++) {
            const denomId = denomIds[i];
            const tokenIds = nftDataJsons.filter((nftDataJson) => nftDataJson.denomId === denomId).map((nftDataJson) => nftDataJson.tokenId);

            const marketplaceNftDtos = await this.graphqlService.fetchMarketplaceNftsByTokenIds(tokenIds, denomId);
            chainMarketplaceNftEntities = chainMarketplaceNftEntities.concat(marketplaceNftDtos);
        }

        // fetch nfts
        const nftFilterEntity = new NftFilterEntity();
        nftFilterEntity.nftIds = chainMarketplaceNftEntities.filter((entity) => validate(entity.uid)).map((entity) => entity.uid);
        const { nftEntities } = await this.nftService.findByFilter(null, nftFilterEntity);

        for (let i = 0; i < nftEntities.length; i++) {
            const nftEntity = nftEntities[i];
            const chainMarketplaceNftEntity = chainMarketplaceNftEntities.find((dto) => dto.uid === nftEntity.id);

            nftEntity.data = chainMarketplaceNftEntity.data;
            nftEntity.name = chainMarketplaceNftEntity.name;
            nftEntity.currentOwner = chainMarketplaceNftEntity.owner;
            nftEntity.uri = chainMarketplaceNftEntity.uri;
            nftEntity.acudosPrice = chainMarketplaceNftEntity.acudosPrice ?? new BigNumber(0);
            nftEntity.tokenId = chainMarketplaceNftEntity.tokenId;
            nftEntity.status = chainMarketplaceNftEntity.burned === true ? NftStatus.REMOVED : NftStatus.MINTED;
            nftEntity.marketplaceNftId = chainMarketplaceNftEntity.marketplaceNftId ? chainMarketplaceNftEntity.marketplaceNftId.toString() : '';

            await this.nftService.updateOneWithStatus(nftEntity.id, nftEntity, req.transaction);
        }
    }

    @ApiBearerAuth('access-token')
    @UseGuards(RoleGuard([AccountType.USER]), IsCreatorOrSuperAdminGuard)
    @Post('updatePrice')
    @HttpCode(200)
    async updatePrice(@Body() req: ReqUpdateNftCudosPrice): Promise<ResUpdateNftCudosPrice> {
        const nftEntity = await this.nftService.updateNftCudosPrice(req.id);

        return new ResUpdateNftCudosPrice(nftEntity);
    }
}
