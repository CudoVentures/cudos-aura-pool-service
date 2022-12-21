import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import BigNumber from 'bignumber.js';
import sequelize, { Op } from 'sequelize';
import UserEntity from '../account/entities/user.entity';
import { CollectionService } from '../collection/collection.service';
import CollectionFilterEntity from '../collection/entities/collection-filter.entity';
import { CollectionEntity } from '../collection/entities/collection.entity';
import { IntBoolValue } from '../common/utils';
import NftMarketplaceTradeHistoryEntity from '../graphql/entities/nft-marketplace-trade-history.entity';
import NftModuleNftTransferEntity from '../graphql/entities/nft-module-nft-transfer-history';
import { GraphqlService } from '../graphql/graphql.service';
import NftFilterEntity from '../nft/entities/nft-filter.entity';
import NftEntity from '../nft/entities/nft.entity';
import { NFTService } from '../nft/nft.service';
import EarningsPerDayEntity from './entities/earnings-per-day.entity';
import MiningFarmEarningsEntity from './entities/mining-farm-earnings.entity';
import NftEarningsEntity from './entities/nft-earnings.entity';
import NftEventFilterEntity from './entities/nft-event-filter.entity';
import NftEventEntity from './entities/nft-event.entity';
import { NftOwnersPayoutHistoryEntity } from './entities/nft-owners-payout-history.entity';
import { NftPayoutHistoryEntity } from './entities/nft-payout-history.entity';
import TotalEarningsEntity from './entities/platform-earnings.entity';
import UserEarningsEntity from './entities/user-earnings.entity';

import { NftOwnersPayoutHistory } from './models/nft-owners-payout-history.model';
import { NftPayoutHistory } from './models/nft-payout-history.model';
import { NftOwnersPayoutHistoryRepo, NftOwnersPayoutHistoryRepoColumn } from './repos/nft-owners-payout-history.repo';
import { NftPayoutHistoryRepo, NftPayoutHistoryRepoColumn } from './repos/nft-payout-history.repo';
import { dayInMs, getDays } from './statistics.types';

@Injectable()
export class StatisticsService {
    constructor(
        private nftService: NFTService,
        @Inject(forwardRef(() => CollectionService))
        private collectionService: CollectionService,
        private graphqlService: GraphqlService,
        @InjectModel(NftPayoutHistory)
        private nftPayoutHistoryModel: typeof NftPayoutHistory,
        @InjectModel(NftOwnersPayoutHistory)
        private nftOwnersPayoutHistoryModel: typeof NftOwnersPayoutHistory,
        @InjectModel(NftPayoutHistoryRepo)
        private nftPayoutHistoryRepo: typeof NftPayoutHistoryRepo,
        @InjectModel(NftOwnersPayoutHistoryRepo)
        private nftOwnersPayoutHistoryRepo: typeof NftOwnersPayoutHistoryRepo,
    ) {}

    async fetchNftEventsByFilter(userEntity: UserEntity, nftEventFilterEntity: NftEventFilterEntity): Promise<{ nftEventEntities: NftEventEntity[], nftEntities: NftEntity[], total: number }> {
        const { nftEventEntities, nftEntitiesMap } = nftEventFilterEntity.isPlatformFilter()
            ? await this.fetchPlatformNftEvents()
            : await this.fetchNftEventsByNftFilter(userEntity, nftEventFilterEntity);

        nftEventEntities.sort((a, b) => ((a.timestamp > b.timestamp) ? 1 : -1))

        // filter for event type
        let filteredNftEntities = nftEventFilterEntity.isEventFilterSet()
            ? nftEventEntities.filter((entity) => nftEventFilterEntity.eventTypes.includes(entity.eventType))
            : nftEventEntities;

        // filter for period
        filteredNftEntities = nftEventFilterEntity.isTimestampFilterSet()
            ? filteredNftEntities.filter((entity) => entity.timestamp >= nftEventFilterEntity.timestampFrom && entity.timestamp <= nftEventFilterEntity.timestampTo)
            : filteredNftEntities;

        // slice
        filteredNftEntities = filteredNftEntities.slice(nftEventFilterEntity.from, nftEventFilterEntity.from + nftEventFilterEntity.count);

        const nftEntities = filteredNftEntities.map((nftEventEntity) => nftEntitiesMap.get(nftEventEntity.nftId));

        return {
            nftEventEntities: filteredNftEntities,
            nftEntities,
            total: nftEventEntities.length,
        }
    }

    private async fetchPlatformNftEvents(): Promise < {nftEventEntities: NftEventEntity[], nftEntitiesMap: Map<string, NftEntity> } > {
        // fetch all events from graphql
        const nftModuleNftTransferEntities = await this.graphqlService.fetchNftPlatformTransferHistory();
        const nftMarketplaceTradeEntities = await this.graphqlService.fetchMarketplacePlatformNftTradeHistory();
        // get denom and token ids for query from db
        let denomIds = nftModuleNftTransferEntities.map((entity) => entity.denomId);
        denomIds = denomIds.concat(nftMarketplaceTradeEntities.map((entity) => entity.denomId));
        denomIds = denomIds.filter((denomId, i) => denomIds.findIndex((id) => id === denomId) === i);

        let tokenIds = nftModuleNftTransferEntities.map((entity) => entity.tokenId);
        tokenIds = tokenIds.concat(nftMarketplaceTradeEntities.map((entity) => entity.tokenId));
        tokenIds = tokenIds.filter((tokenId, i) => tokenIds.findIndex((id) => id === tokenId) === i);

        // get collections so we can query nfts by collection ids
        const collections = await this.collectionService.findByDenomIds(denomIds);
        const collectionIdCollectionMap = new Map<number, CollectionEntity>();
        collections.forEach((entity) => collectionIdCollectionMap.set(entity.id, entity));

        // get nfts by collection ids and token ids
        const nfts = await this.nftService.findByCollectionIdsAndTokenIds(
            collections.map((entity) => entity.id),
            tokenIds,
        );

        // create a map for faster mapping of the graph ql values
        const denomIdTokenIdNftsMap = new Map<string, Map<string, NftEntity>>();
        nfts.forEach((nftEntity) => {
            const collectionEntity: CollectionEntity = collectionIdCollectionMap.get(nftEntity.collectionId);

            const nftMap: Map<string, NftEntity> = denomIdTokenIdNftsMap.has(collectionEntity.denomId)
                ? denomIdTokenIdNftsMap.get(collectionEntity.denomId)
                : new Map<string, NftEntity>();

            nftMap.set(nftEntity.tokenId, nftEntity);
            denomIdTokenIdNftsMap.set(collectionEntity.denomId, nftMap);
        })

        const nftEventEntities: NftEventEntity[] = [];

        nftModuleNftTransferEntities.forEach((nftModuleNftTransferEntity: NftModuleNftTransferEntity) => {
            const nftMapForDenom = denomIdTokenIdNftsMap.get(nftModuleNftTransferEntity.denomId);
            if (!nftMapForDenom) {
                return;
            }

            const nftId = nftMapForDenom.get(nftModuleNftTransferEntity.tokenId)?.id;

            if (!nftId) {
                return;
            }

            const nftEventEntity = NftEventEntity.fromNftModuleTransferHistory(nftModuleNftTransferEntity);
            nftEventEntity.nftId = nftId;

            nftEventEntities.push(nftEventEntity);
        });

        nftMarketplaceTradeEntities.forEach((nftMarketplaceTradeHistoryEntity: NftMarketplaceTradeHistoryEntity) => {
            console.log(nftMarketplaceTradeHistoryEntity)
            const nftMapForDenom = denomIdTokenIdNftsMap.get(nftMarketplaceTradeHistoryEntity.denomId);
            if (!nftMapForDenom) {
                return;
            }

            const nftId = nftMapForDenom.get(nftMarketplaceTradeHistoryEntity.tokenId)?.id;

            if (!nftId) {
                return;
            }

            const nftEventEntity = NftEventEntity.fromNftMarketplaceTradeHistory(nftMarketplaceTradeHistoryEntity);
            nftEventEntity.nftId = nftId;

            nftEventEntities.push(nftEventEntity);
        });

        // make nft map for faster filter later
        const nftEntitiesMap = new Map<string, NftEntity>();
        nfts.forEach((nftEntity) => {
            nftEntitiesMap.set(nftEntity.id, nftEntity);
        })

        return {
            nftEventEntities,
            nftEntitiesMap,
        }
    }

    private async fetchNftEventsByNftFilter(userEntity: UserEntity, nftEventFilterEntity: NftEventFilterEntity): Promise< {nftEventEntities: NftEventEntity[], nftEntitiesMap: Map<string, NftEntity> } > {
        const nftFilterEntity = new NftFilterEntity();

        if (nftEventFilterEntity.isBySessionAccount() === true) {
            nftFilterEntity.sessionAccount = IntBoolValue.TRUE;
        }
        if (nftEventFilterEntity.isByNftId()) {
            nftFilterEntity.nftIds = [nftEventFilterEntity.nftId];
        }

        const { nftEntities } = await this.nftService.findByFilter(userEntity, nftFilterEntity)

        const collectionFilter = new CollectionFilterEntity();
        collectionFilter.collectionIds = nftEntities.map((nftEntity) => nftEntity.collectionId.toString());
        const { collectionEntities } = await this.collectionService.findByFilter(collectionFilter);

        const nftEventEntities: NftEventEntity[] = [];

        // TODO: make better after new column uniw_id is implemented in bdjuno
        for (let i = 0; i < collectionEntities.length; i++) {
            const collectionEntity = collectionEntities[i];
            const denomId = collectionEntity.denomId;
            const nftEntitiesForCollection = nftEntities.filter((nftEntity) => nftEntity.collectionId === collectionEntity.id);
            const nftTokenIdNftMap = new Map<string, NftEntity>();
            nftEntitiesForCollection.forEach((nftEntity) => nftTokenIdNftMap.set(nftEntity.tokenId, nftEntity));
            if (nftEntitiesForCollection.length === 0) {
                throw Error('Some problem with relations collectionId and nft');
            }

            const tokenIds = nftEntitiesForCollection.map((nftEntity) => nftEntity.tokenId);

            const nftModuleNftTransferEntities = await this.graphqlService.fetchNftTransferHistory(denomId, tokenIds);
            const nftMarketplaceTradeEntities = await this.graphqlService.fetchMarketplaceNftTradeHistory(denomId, tokenIds);

            nftModuleNftTransferEntities.forEach((nftModuleNftTransferEntity: NftModuleNftTransferEntity) => {
                const nftId = nftTokenIdNftMap.get(nftModuleNftTransferEntity.tokenId).id;
                const nftTransferHistoryEntity = NftEventEntity.fromNftModuleTransferHistory(nftModuleNftTransferEntity);
                nftTransferHistoryEntity.nftId = nftId;

                nftEventEntities.push(nftTransferHistoryEntity);
            })

            nftMarketplaceTradeEntities.forEach((nftMarketplaceTradeHistoryEntity: NftMarketplaceTradeHistoryEntity) => {
                const nftId = nftTokenIdNftMap.get(nftMarketplaceTradeHistoryEntity.tokenId).id;
                const nftTransferHistoryEntity = NftEventEntity.fromNftMarketplaceTradeHistory(nftMarketplaceTradeHistoryEntity);
                nftTransferHistoryEntity.nftId = nftId;

                nftEventEntities.push(nftTransferHistoryEntity);
            })
        }

        const nftEntitiesMap = new Map<string, NftEntity>();
        nftEntities.forEach((nftEntity) => {
            nftEntitiesMap.set(nftEntity.id, nftEntity);
        })

        return {
            nftEventEntities,
            nftEntitiesMap,
        }
    }

    async fetchEarningsByCudosAddress(cudosAddress: string, timestampFrom: number, timestampTo: number): Promise < UserEarningsEntity > {
        const earningsPerDayEntity = new EarningsPerDayEntity(timestampFrom, timestampTo);
        const nftOwnersPayoutHistoryEntities = await this.fetchNftOwnersPayoutHistoryByCudosAddress(cudosAddress, timestampFrom, timestampTo);
        earningsPerDayEntity.calculateEarningsByNftOwnersPayoutHistory(nftOwnersPayoutHistoryEntities);

        const sqlRow = await this.nftOwnersPayoutHistoryRepo.findOne({
            where: {
                [NftOwnersPayoutHistoryRepoColumn.OWNER]: cudosAddress,
                [NftOwnersPayoutHistoryRepoColumn.SENT]: true,
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col(NftOwnersPayoutHistoryRepoColumn.REWARD)), 'sumOfRewards'],
            ],
        });
        const sumOfRewards = sqlRow.getDataValue('sumOfRewards');
        const totalEarningInBtc = new BigNumber(sumOfRewards ?? 0);

        // const totalNftsOwned = await this.graphqlService.fetchTotalNftsByAddress(cudosAddress);
        const activeNftEntities = await this.nftService.findActiveByCurrentOwner(cudosAddress);
        const totalContractHashPowerInTh = activeNftEntities.reduce((acc, nftEntity) => {
            return acc + nftEntity.hashingPower;
        }, 0);

        const userEarningsEntity = new UserEarningsEntity();
        userEarningsEntity.totalEarningInBtc = totalEarningInBtc;
        userEarningsEntity.totalNftBought = activeNftEntities.length;
        userEarningsEntity.totalContractHashPowerInTh = totalContractHashPowerInTh;
        userEarningsEntity.earningsPerDayInBtc = earningsPerDayEntity.earningsPerDayInBtc;
        userEarningsEntity.btcEarnedInBtc = earningsPerDayEntity.sumEarnings();

        return userEarningsEntity;
    }

    async fetchEarningsByNftId(nftId: string, timestampFrom: number, timestampTo: number): Promise < NftEarningsEntity > {
        const earningsPerDayEntity = new EarningsPerDayEntity(timestampFrom, timestampTo);

        const nftEntity = await this.nftService.findOne(nftId);
        if (nftEntity.isMinted() === true) {
            const nftPayoutHistoryEntities = await this.fetchPayoutHistoryByTokenId(nftEntity.tokenId);
            const nftPayoutHistoryIds = nftPayoutHistoryEntities.map((nftPayoutHistoryEntity) => nftPayoutHistoryEntity.id);
            const nftOwnersPayoutHistoryEntities = await this.fetchNftOwnersPayoutHistoryByPayoutHistoryIds(nftPayoutHistoryIds, timestampFrom, timestampTo);
            earningsPerDayEntity.calculateEarningsByNftOwnersPayoutHistory(nftOwnersPayoutHistoryEntities);
        }

        const nftEarningsEntity = new NftEarningsEntity();
        nftEarningsEntity.earningsPerDayInBtc = earningsPerDayEntity.earningsPerDayInBtc;
        return nftEarningsEntity;
    }

    async fetchEarningsByMiningFarmId(miningFarmId: number, timestampFrom: number, timestampTo: number): Promise < MiningFarmEarningsEntity > {
        const days = getDays(Number(timestampFrom), Number(timestampTo))

        const collections = await this.collectionService.findByFarmId(miningFarmId)
        const tempNftFilterEntity = new NftFilterEntity();
        tempNftFilterEntity.collectionIds = collections.map((collection) => collection.id.toString())
        const { nftEntities } = await this.nftService.findByFilter(null, tempNftFilterEntity);

        const nfts = (await Promise.all(nftEntities)).flat().filter((nft) => nft.tokenId !== '')

        const totalFarmSales = await this.graphqlService.fetchCollectionTotalSales(collections.map((collection) => collection.denomId))

        const nftsWithPayoutHistoryForPeriod = await Promise.all(nfts.map(async (nft) => {
            const payoutHistoryForPeriod = await this.nftPayoutHistoryModel.findAll({ where: {
                tokenId: nft.tokenId,
                denomId: collections.find((collection) => collection.id === nft.collectionId).denomId,
                payout_period_start: {
                    [Op.gte]: Number(timestampFrom) / 1000,
                },
                payout_period_end: {
                    [Op.lte]: Number(timestampTo) / 1000,
                },
            } })

            const nftMaintenanceFeeForPeriod = payoutHistoryForPeriod.reduce((prevValue, currValue) => prevValue + currValue.maintenance_fee, 0)
            return {
                ...NftEntity.toJson(nft),
                nftMaintenanceFeeForPeriod,
                payoutHistoryForPeriod,
            }
        }))

        const maintenanceFeeDepositedInBtc = nftsWithPayoutHistoryForPeriod.reduce((prevValue, currValue) => prevValue + currValue.nftMaintenanceFeeForPeriod, 0)

        const earningsPerDayInUsd = days.map((day) => {
            let earningsForDay = 0

            nftsWithPayoutHistoryForPeriod.map((nft) => nft.payoutHistoryForPeriod.forEach((nftPayoutHistory) => {
                if ((nftPayoutHistory.payout_period_start * 1000) >= day && (nftPayoutHistory.payout_period_end * 1000) <= day + dayInMs) {
                    earningsForDay += Number(nftPayoutHistory.reward)
                }
            }))

            return earningsForDay
        })

        const miningFarmEarningsEntity = new MiningFarmEarningsEntity();
        miningFarmEarningsEntity.totalMiningFarmSalesInAcudos = new BigNumber(totalFarmSales.salesInAcudos || 0);
        miningFarmEarningsEntity.totalNftSold = nfts.length;
        // miningFarmEarningsEntity.totalMiningFarmSalesInUsd = totalFarmSales.salesInUsd || 0;
        miningFarmEarningsEntity.maintenanceFeeDepositedInBtc = new BigNumber(maintenanceFeeDepositedInBtc);
        miningFarmEarningsEntity.earningsPerDayInUsd = earningsPerDayInUsd;

        return miningFarmEarningsEntity;
    }

    async fetchPlatformEarnings(timestampFrom: number, timestampTo: number): Promise < TotalEarningsEntity > {
        const days = getDays(Number(timestampFrom), Number(timestampTo))

        const payoutHistoryForPeriod = await this.nftPayoutHistoryModel.findAll({ where: {
            payout_period_start: {
                [Op.gte]: Number(timestampFrom) / 1000,
            },
            payout_period_end: {
                [Op.lte]: Number(timestampTo) / 1000,
            },
        } })

        const earningsPerDayInUsd = days.map((day) => {
            let earningsForDay = 0

            payoutHistoryForPeriod.forEach((nftPayoutHistory) => {
                if ((nftPayoutHistory.payout_period_start * 1000) >= day && (nftPayoutHistory.payout_period_end * 1000) <= day + dayInMs) {
                    earningsForDay += Number(nftPayoutHistory.reward)
                }
            })

            return earningsForDay
        })

        const { salesInAcudos } = await this.graphqlService.fetchTotalPlatformSales();

        const totalEarningsEntity = new TotalEarningsEntity();

        totalEarningsEntity.totalSalesInAcudos = salesInAcudos
        totalEarningsEntity.earningsPerDayInUsd = earningsPerDayInUsd;

        return totalEarningsEntity;
    }

    private async fetchNftOwnersPayoutHistoryByCudosAddress(cudosAddress: string, timestampFrom: number, timestampTo: number): Promise < NftOwnersPayoutHistoryEntities[] > {
        const nftOwnersPayoutHistoryRepos = await this.nftOwnersPayoutHistoryRepo.findAll({
            where: {
                [NftOwnersPayoutHistoryRepoColumn.OWNER]: cudosAddress,
                [NftOwnersPayoutHistoryRepoColumn.CREATED_AT]: {
                    [Op.gte]: new Date(timestampFrom),
                },
                [NftOwnersPayoutHistoryRepoColumn.CREATED_AT]: {
                    [Op.lte]: new Date(timestampTo),
                },
                [NftOwnersPayoutHistoryRepoColumn.SENT]: true,
            },
        });
        return nftOwnersPayoutHistoryRepos.map((nftOwnersPayoutHistoryRepo) => {
            return NftOwnersPayoutHistoryEntity.fromRepo(nftOwnersPayoutHistoryRepo);
        });
    }

    private async fetchNftOwnersPayoutHistoryByPayoutHistoryIds(nftPayoutHistoryIds: number[], timestampFrom: number, timestampTo: number): Promise < NftOwnersPayoutHistoryEntities[] > {
        const nftOwnersPayoutHistoryRepos = await this.nftOwnersPayoutHistoryRepo.findAll({
            where: {
                [NftOwnersPayoutHistoryRepoColumn.OWNER]: nftPayoutHistoryIds,
                [NftOwnersPayoutHistoryRepoColumn.CREATED_AT]: {
                    [Op.gte]: new Date(timestampFrom),
                },
                [NftOwnersPayoutHistoryRepoColumn.CREATED_AT]: {
                    [Op.lte]: new Date(timestampTo),
                },
                [NftOwnersPayoutHistoryRepoColumn.SENT]: true,
            },
        });
        return nftOwnersPayoutHistoryRepos.map((nftOwnersPayoutHistoryRepo) => {
            return NftOwnersPayoutHistoryEntity.fromRepo(nftOwnersPayoutHistoryRepo);
        });
    }

    private async fetchPayoutHistoryByTokenId(tokenId: string): Promise < NftPayoutHistoryEntity[] > {
        const nftPayoutHistoryRepos = await this.nftPayoutHistoryRepo.findAll({
            where: {
                [NftPayoutHistoryRepoColumn.TOKEN_ID]: tokenId,
            },
        })
        return nftPayoutHistoryRepos.map((nftPayoutHistoryRepo) => {
            return NftPayoutHistoryEntity.fromRepo(nftPayoutHistoryRepo);
        });
    }
}
