import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import BigNumber from 'bignumber.js';
import { Op } from 'sequelize';
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
import MiningFarmEarningsEntity from './entities/mining-farm-earnings.entity';
import NftEarningsEntity from './entities/nft-earnings.entity';
import NftEventFilterEntity from './entities/nft-event-filter.entity';
import NftEventEntity from './entities/nft-event.entity';
import TotalEarningsEntity from './entities/platform-earnings.entity';
import UserEarningsEntity from './entities/user-earnings.entity';

import { NftOwnersPayoutHistory } from './models/nft-owners-payout-history.model';
import { NftPayoutHistory } from './models/nft-payout-history.model';
import { dayInMs, getDays } from './utils';

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
        const days = getDays(Number(timestampFrom), Number(timestampTo))

        const ownerPayoutHistoryForPeriod = await this.nftOwnersPayoutHistoryModel.findAll({
            where: {
                owner: cudosAddress,
            },
            include: [{ model: NftPayoutHistory,
                where: {
                    payout_period_start: {
                        [Op.gte]: timestampFrom / 1000,
                    },
                    payout_period_end: {
                        [Op.lte]: timestampTo / 1000,
                    },
                },
            }],
        })
        const rewardsPerDay = days.map((day) => ownerPayoutHistoryForPeriod.filter((row) => (row.nft_payout_history.payout_period_start * 1000) >= day && (row.nft_payout_history.payout_period_end * 1000) <= day + dayInMs).reduce((prevVal, currVal) => prevVal + Number(currVal.reward), 0))

        const ownerPayoutHistory = await this.nftOwnersPayoutHistoryModel.findAll({
            where: {
                owner: cudosAddress,
            },
        })
        const totalEarningInBtc = ownerPayoutHistory.reduce((prevVal, currVal) => prevVal + Number(currVal.reward), 0)

        const totalNftsOwned = await this.graphqlService.fetchTotalNftsByAddress(cudosAddress)

        const userEarningsEntity = new UserEarningsEntity();
        userEarningsEntity.totalEarningInBtc = new BigNumber(totalEarningInBtc);
        userEarningsEntity.totalNftBought = totalNftsOwned;
        userEarningsEntity.earningsPerDayInUsd = rewardsPerDay;
        userEarningsEntity.btcEarnedInBtc = new BigNumber(0);

        return userEarningsEntity;
        // return {
        //     totalEarningInBtc,
        //     totalNftBought: totalNftsOwned,
        //     earningsPerDayInUsd: rewardsPerDay,
        //     btcEarnedInBtc: 0,
        // }
    }

    async fetchEarningsByNftId(nftId: string, timestampFrom: number, timestampTo: number): Promise < NftEarningsEntity > {
        const nftEntity = await this.nftService.findOne(nftId)
        const collectionEntity = await this.collectionService.findOne(nftEntity.collectionId);
        const tokenId = nftEntity.tokenId;
        const denomId = collectionEntity.denomId;

        const days = getDays(Number(timestampFrom), Number(timestampTo))

        if (!tokenId) {
            return new NftEarningsEntity();
        }
        const payoutHistory = await this.nftPayoutHistoryModel.findAll({ where: {
            token_id: tokenId,
            denom_id: denomId,
            payout_period_start: {
                [Op.gte]: Number(timestampFrom) / 1000,

            },
            payout_period_end: {
                [Op.lte]: Number(timestampTo) / 1000,
            },
        } })

        const rewardsPerDay = days.map(((day) => payoutHistory.find((row) => (row.payout_period_start * 1000) >= day && (row.payout_period_end * 1000) <= day + dayInMs)?.reward.toString() || null))

        const nftEarningsEntity = new NftEarningsEntity();
        nftEarningsEntity.earningsPerDayInBtc = rewardsPerDay.map((s) => new BigNumber(s));
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
}
