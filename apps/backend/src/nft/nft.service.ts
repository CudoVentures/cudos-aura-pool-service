import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { LOCK, Op, Transaction } from 'sequelize';
import { v4 as uuid } from 'uuid';
import { CollectionService } from '../collection/collection.service';
import { VisitorService } from '../visitor/visitor.service';
import { NftRepo, NftRepoColumn } from './repos/nft.repo';
import { NftGroup, NftOrderBy, NftStatus } from './nft.types';
import NftEntity from './entities/nft.entity';
import NftFilterEntity from './entities/nft-filter.entity';
import UserEntity from '../account/entities/user.entity';
import AppRepo from '../common/repo/app.repo';
import CoinGeckoService from '../coin-gecko/coin-gecko.service';
import BigNumber from 'bignumber.js';
import { CURRENCY_DECIMALS } from 'cudosjs';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { FIFTEEN_MINUTES_IN_MILIS } from '../common/utils';

enum Tier {
    TIER_1 = 1, // cheapest
    TIER_2 = 2,
    TIER_3 = 3,
    TIER_4 = 4,
    TIER_5 = 5 // most expensive
}

const tierBorderMap = new Map<Tier, number>([
    [Tier.TIER_5, 9983],
    [Tier.TIER_4, 9937],
    [Tier.TIER_3, 9439],
    [Tier.TIER_2, 1912],
    [Tier.TIER_1, 0],
])

const tierPriceMap = new Map<Tier, number>([
    [Tier.TIER_1, 150],
    [Tier.TIER_2, 300],
    [Tier.TIER_3, 1000],
    [Tier.TIER_4, 3000],
    [Tier.TIER_5, 5000],
])

@Injectable()
export class NFTService {
    constructor(
        @InjectModel(NftRepo)
        private nftRepo: typeof NftRepo,
        @Inject(forwardRef(() => CollectionService))
        private collectionService: CollectionService,
        private visitorService: VisitorService,
        private coinGeckoService: CoinGeckoService,
        private configService: ConfigService,
    ) {}

    // controller functions
    async findByFilter(userEntity: UserEntity, nftFilterEntity: NftFilterEntity, dbTx: Transaction, dbLock: LOCK = undefined): Promise < { nftEntities: NftEntity[], total: number } > {
        let whereClause: any = {};
        let orderByClause: any[] = null;

        if (nftFilterEntity.hasNftIds() === true) {
            whereClause.id = nftFilterEntity.nftIds;
        }

        if (nftFilterEntity.hasCollectionStatus() === true) {
            whereClause.collection_id = await this.collectionService.findIdsByStatus(nftFilterEntity.getCollectionStatus(), dbTx);
        }

        if (nftFilterEntity.hasNftStatus() === true) {
            whereClause.status = nftFilterEntity.nftStatus;
        }

        if (nftFilterEntity.hasNftGroup() === true) {
            whereClause.group = nftFilterEntity.nftGroup;
        }

        if (nftFilterEntity.hasCollectionIds() === true) {
            if (whereClause.collection_id === undefined) {
                whereClause.collection_id = nftFilterEntity.collectionIds;
            } else {
                const set = new Set(whereClause.collection_id);
                whereClause.collection_id = nftFilterEntity.collectionIds.filter((colId) => {
                    return set.has(colId);
                });
            }
        }

        if (nftFilterEntity.inOnlyForSessionAccount() === true) {
            whereClause.current_owner = userEntity.cudosWalletAddress;
        }

        if (nftFilterEntity.hasSearchString() === true) {
            whereClause = [
                whereClause,
                sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), { [Op.like]: `%${nftFilterEntity.searchString.toLowerCase()}%` }),
            ]
        }

        switch (nftFilterEntity.orderBy) {
            case NftOrderBy.PRICE_ASC:
            case NftOrderBy.PRICE_DESC:
                orderByClause = [['price']]
                break;
            case NftOrderBy.TIMESTAMP_ASC:
            case NftOrderBy.TIMESTAMP_DESC:
            default:
                orderByClause = [['createdAt']]
                break;
        }
        if (orderByClause !== null) {
            orderByClause[0].push(nftFilterEntity.orderBy > 0 ? 'ASC' : 'DESC');
        }

        const nftRepos = await this.nftRepo.findAll({
            where: whereClause,
            order: orderByClause,
            transaction: dbTx,
            lock: dbLock,
        });

        let nftEntities = nftRepos.map((nftRepo) => NftEntity.fromRepo(nftRepo));
        if (nftFilterEntity.isSortByTrending() === true) {
            const nftIds = nftEntities.map((nftEntity) => {
                return nftEntity.id.toString();
            });
            const sortDirection = Math.floor(Math.abs(nftFilterEntity.orderBy) / nftFilterEntity.orderBy);
            const visitorMap = await this.visitorService.fetchNftsVisitsCountAsMap(nftIds, dbTx, dbLock);
            nftEntities.sort((a: NftEntity, b: NftEntity) => {
                const visitsA = visitorMap.get(a.id.toString()) ?? 0;
                const visitsB = visitorMap.get(b.id.toString()) ?? 0;
                return sortDirection * (visitsA - visitsB);
            });
        }

        const total = nftEntities.length;
        nftEntities = nftEntities.slice(nftFilterEntity.from, nftFilterEntity.from + nftFilterEntity.count);

        return {
            nftEntities,
            total,
        };

    }

    async getRandomPresaleNft(paidAmountAcudos: BigNumber, dbTx: Transaction, dbLock: LOCK = undefined): Promise <NftEntity> {
        // check if paid price is within epsilon of expected
        const { cudosUsdPrice } = await this.coinGeckoService.fetchCudosPrice();
        const paidAmountCudos = paidAmountAcudos.shiftedBy(-CURRENCY_DECIMALS);
        const paidAmountUsd = paidAmountCudos.multipliedBy(cudosUsdPrice);

        const expectedUsd = Number(this.configService.get<string>('APP_PRESALE_PRICE_USD'));
        const presaleExpectedPriceEpsilon = this.configService.get<number>('APP_PRESALE_EXPECTED_PRICE_EPSILON');
        const expectedUsdEpsilonAbsolute = expectedUsd * presaleExpectedPriceEpsilon;

        if (paidAmountUsd.lt(expectedUsd - expectedUsdEpsilonAbsolute) || paidAmountUsd.gt(expectedUsd + expectedUsdEpsilonAbsolute)) {
            return null;
        }

        const collectionId = parseInt(this.configService.get<string>('APP_PRESALE_COLLECTION_ID'));
        // get a tier by random, if a tier is finished - add it to the closes lower tier
        const randomNumber = randomInt(1, 10001);

        let tier = Tier.TIER_1;
        if (randomNumber > tierBorderMap.get(Tier.TIER_5)) {
            tier = Tier.TIER_5;
        } else if (randomNumber > tierBorderMap.get(Tier.TIER_4)) {
            tier = Tier.TIER_4;
        } else if (randomNumber > tierBorderMap.get(Tier.TIER_3)) {
            tier = Tier.TIER_3;
        } else if (randomNumber > tierBorderMap.get(Tier.TIER_2)) {
            tier = Tier.TIER_2;
        }

        const tierArray = [];
        for (let i = tier; i >= Tier.TIER_1; i--) {
            tierArray.push(i);
        }
        for (let i = tier + 1; i <= Tier.TIER_5; i++) {
            tierArray.push(i);
        }

        for (let i = 0; i < tierArray.length; i++) {
            const tierToQuery = tierArray[i];
            // get tier price range
            const priceUsd = tierPriceMap.get(tierToQuery);

            // get nft in price by random
            const nftTierEntities = await this.findAllPresaleByCollectionAndPriceUsd(collectionId, priceUsd, dbTx, dbLock);

            if (nftTierEntities.length > 0) {
                const nftIndex = randomInt(0, nftTierEntities.length);

                return nftTierEntities[nftIndex];
            }
        }

        return null;
    }

    async updatePremintNftPrice(nftEntity: NftEntity, paidAmountAcudos: BigNumber, dbTx: Transaction): Promise <NftEntity> {
        nftEntity.acudosPrice = paidAmountAcudos;

        nftEntity.priceAcudosValidUntil = Date.now() + FIFTEEN_MINUTES_IN_MILIS;

        await this.updateOne(nftEntity.id, nftEntity, dbTx);

        return nftEntity;
    }

    async updateOneWithStatus(id: string, nftEntity: NftEntity, dbTx: Transaction): Promise < NftEntity > {
        const [count, [nftRepo]] = await this.nftRepo.update(NftEntity.toRepo(nftEntity).toJSON(), {
            where: { id },
            returning: true,
            transaction: dbTx,
        });

        return NftEntity.fromRepo(nftRepo);
    }

    async updateNftCudosPrice(id: string, dbTx: Transaction): Promise < NftEntity> {
        const nftEntity = await this.findOne(id, dbTx, dbTx.LOCK.UPDATE);
        if (nftEntity === null) {
            throw new NotFoundException();
        }

        if (nftEntity.isMinted()) {
            throw new NotFoundException();
        }

        const { cudosUsdPrice } = await this.coinGeckoService.fetchCudosPrice();
        const cudosPrice = (new BigNumber(nftEntity.priceUsd)).dividedBy(cudosUsdPrice);
        const acudosPrice = cudosPrice.shiftedBy(CURRENCY_DECIMALS)

        nftEntity.acudosPrice = new BigNumber(acudosPrice.toFixed(0));

        nftEntity.priceAcudosValidUntil = Date.now() + FIFTEEN_MINUTES_IN_MILIS;

        return this.updateOne(id, nftEntity, dbTx);
    }

    async fetchPresaleAmounts(dbTx: Transaction): Promise < {totalPresaleNftCount: number, presaleMintedNftCount: number} > {
        const collectionId = this.configService.get<string>('APP_PRESALE_COLLECTION_ID');

        const nftFilter = new NftFilterEntity();
        nftFilter.collectionIds = [collectionId]
        nftFilter.nftGroup = [NftGroup.PRESALE]

        const { nftEntities } = await this.findByFilter(null, nftFilter, dbTx);
        const totalPresaleNftCount = nftEntities.length;
        const presaleMintedNftCount = nftEntities.filter((nftEntity: NftEntity) => nftEntity.isMinted() === true).length;

        return { totalPresaleNftCount, presaleMintedNftCount }
    }

    // utilty functions
    async findActiveByCurrentOwner(cudosWalletAddress: string, dbTx: Transaction, dbLock: LOCK = undefined): Promise < NftEntity[] > {
        const nftRepos = await this.nftRepo.findAll({
            where: {
                [NftRepoColumn.CURRENT_OWNER]: cudosWalletAddress,
                [NftRepoColumn.STATUS]: NftStatus.MINTED,
                [NftRepoColumn.EXPIRATION_DATE]: {
                    [Op.gt]: new Date(),
                },
            },
            transaction: dbTx,
            lock: dbLock,
        });

        return nftRepos.map((nftRepo) => {
            return NftEntity.fromRepo(nftRepo);
        });
    }

    async findAllPresaleByCollectionAndPriceUsd(collecionId: number, priceUsd: number, dbTx: Transaction, dbLock: LOCK = undefined) {
        const whereClause = {
            [NftRepoColumn.COLLECTION_ID]: collecionId,
            [NftRepoColumn.PRICE_USD]: priceUsd,
            [NftRepoColumn.TOKEN_ID]: '',
            [NftRepoColumn.PRICE_VALID_UNTIL]: {
                [Op.lt]: Date.now(),
            },
            [NftRepoColumn.GROUP]: NftGroup.PRESALE,
        };

        const nftRepos = await this.nftRepo.findAll({
            where: whereClause,
            transaction: dbTx,
            lock: dbLock,
        });

        return nftRepos.map((nftRepo) => {
            return NftEntity.fromRepo(nftRepo);
        });
    }

    async findByCollectionIds(collectionIds: number[], dbTx: Transaction, dbLock: LOCK = undefined): Promise < NftEntity[] > {
        const nftRepos = await this.nftRepo.findAll({
            where: {
                [NftRepoColumn.COLLECTION_ID]: collectionIds,
            },
            transaction: dbTx,
            lock: dbLock,
        });

        return nftRepos.map((nftRepo) => {
            return NftEntity.fromRepo(nftRepo);
        });
    }

    async findByCollectionIdsAndTokenIds(collectionIds: number[], tokenIds: string[], dbTx: Transaction, dbLock: LOCK = undefined): Promise < NftEntity[] > {
        const nftRepos = await this.nftRepo.findAll({
            where: {
                [NftRepoColumn.COLLECTION_ID]: collectionIds,
                [NftRepoColumn.TOKEN_ID]: tokenIds,
            },
            transaction: dbTx,
            lock: dbLock,
        });

        return nftRepos.map((nftRepo) => {
            return NftEntity.fromRepo(nftRepo);
        });
    }

    async findOne(id: string, dbTx: Transaction, dbLock: LOCK = undefined): Promise < NftEntity > {
        const nftRepo = await this.nftRepo.findByPk(id, {
            transaction: dbTx,
            lock: dbLock,
        });

        if (!nftRepo) {
            throw new NotFoundException();
        }

        return NftEntity.fromRepo(nftRepo);
    }

    async createOne(nftEntity: NftEntity, dbTx: Transaction): Promise < NftEntity > {
        nftEntity.currentOwner = '';
        nftEntity.markAsQueued();

        const repo = NftEntity.toRepo(nftEntity);
        repo.id = uuid();
        const nftRepo = await this.nftRepo.create(repo.toJSON(), {
            transaction: dbTx,
        });

        return NftEntity.fromRepo(nftRepo);
    }

    async updateOne(id: string, nftEntity: NftEntity, dbTx: Transaction): Promise < NftEntity > {
        nftEntity.markAsQueued();
        const [count, [nftRepo]] = await this.nftRepo.update(NftEntity.toRepo(nftEntity).toJSON(), {
            where: { id },
            returning: true,
            transaction: dbTx,
        });

        return NftEntity.fromRepo(nftRepo);
    }

    async deleteMany(nftEntities: NftEntity[], dbTx: Transaction): Promise <void> {
        await this.nftRepo.destroy({
            where: {
                [NftRepoColumn.ID]: nftEntities.map((nftEntity) => nftEntity.id),
            },
            transaction: dbTx,
        });
    }

}
