import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Collection } from '../collection/collection.model';
import { NFT } from '../nft/nft.model';
import { NftStatus } from '../nft/nft.types';
import { HttpService } from '@nestjs/axios';
import { CollectionStatus } from '../collection/utils';
import MiningFarmFilterModel from './dto/farm-filter.mdel';
import sequelize, { LOCK, Op, Transaction } from 'sequelize';
import { VisitorService } from '../visitor/visitor.service';
import AccountEntity from '../account/entities/account.entity';
import MiningFarmEntity from './entities/mining-farm.entity';
import { MiningFarmRepo, MiningFarmRepoColumn } from './repos/mining-farm.repo';
import AppRepo from '../common/repo/app.repo';
import DataService from '../data/data.service';
import { DataServiceError } from '../common/errors/errors';
import EnergySourceEntity from './entities/energy-source.entity';
import { EnergySourceRepo } from './repos/energy-source.repo';
import { MinerRepo } from './repos/miner.repo';
import { ManufacturerRepo } from './repos/manufacturer.repo';
import MinerEntity from './entities/miner.entity';
import ManufacturerEntity from './entities/manufacturer.entity';
import MiningFarmDetailsEntity from './entities/mining-farm-details.entity';

@Injectable()
export class FarmService {
    constructor(
        @InjectModel(MiningFarmRepo)
        private miningFarmRepo: typeof MiningFarmRepo,
        @InjectModel(EnergySourceRepo)
        private energySourceRepo: typeof EnergySourceRepo,
        @InjectModel(MinerRepo)
        private minerRepo: typeof MinerRepo,
        @InjectModel(ManufacturerRepo)
        private manufacturerRepo: typeof ManufacturerRepo,
        @InjectModel(Collection)
        private collectionModel: typeof Collection,
        @InjectModel(NFT)
        private nftModel: typeof NFT,
        private httpService: HttpService,
        private visitorService: VisitorService,
        private dataService: DataService,
    ) {}

    async findByFilter(accountEntity: AccountEntity, miningFarmFilterModel: MiningFarmFilterModel): Promise < { miningFarmEntities: MiningFarmEntity[], total: number } > {
        let whereClause: any = {};

        if (miningFarmFilterModel.hasMiningFarmIds() === true) {
            whereClause[MiningFarmRepoColumn.ID] = miningFarmFilterModel.miningFarmIds;
        }

        if (miningFarmFilterModel.hasMiningFarmStatus() === true) {
            whereClause[MiningFarmRepoColumn.STATUS] = miningFarmFilterModel.getMiningFarmStatus();
        }

        if (miningFarmFilterModel.inOnlyForSessionAccount() === true) {
            whereClause[MiningFarmRepoColumn.CREATOR_ID] = accountEntity.accountId;
        }

        if (miningFarmFilterModel.hasSearchString() === true) {
            whereClause = [
                whereClause,
                sequelize.where(sequelize.fn('LOWER', sequelize.col(MiningFarmRepoColumn.NAME)), { [Op.like]: `%${miningFarmFilterModel.searchString.toLowerCase()}%` }),
            ]
        }

        const miningFarmRepos = await this.miningFarmRepo.findAll({
            where: whereClause,
        });
        let miningFarmEntities = miningFarmRepos.map((miningFarmRepo) => {
            return MiningFarmEntity.fromRepo(miningFarmRepo);
        });

        if (miningFarmFilterModel.isSortByPopular() === true) {
            const miningFarmIds = miningFarmEntities.map((miningFarmEntity) => {
                return miningFarmEntity.id;
            });
            const sortDirection = Math.floor(Math.abs(miningFarmFilterModel.orderBy) / miningFarmFilterModel.orderBy);
            const visitorMap = await this.visitorService.fetchMiningFarmVisitsCount(miningFarmIds);
            miningFarmEntities.sort((a: MiningFarmEntity, b: MiningFarmEntity) => {
                const visitsA = visitorMap.get(a.id) ?? 0;
                const visitsB = visitorMap.get(b.id) ?? 0;
                return sortDirection * (visitsA - visitsB);
            });
        }

        const total = miningFarmEntities.length;
        miningFarmEntities = miningFarmEntities.slice(miningFarmFilterModel.from, miningFarmFilterModel.from + miningFarmFilterModel.count);

        return {
            miningFarmEntities,
            total,
        };
    }

    async findMiningFarmById(id: number, tx: Transaction = undefined, lock: LOCK = undefined): Promise < MiningFarmEntity > {
        const miningFarmRepo = await this.miningFarmRepo.findByPk(id, {
            transaction: tx,
            lock,
        });
        return MiningFarmEntity.fromRepo(miningFarmRepo);
    }

    async creditMiningFarm(miningFarmEntity: MiningFarmEntity, creditImages = true, tx: Transaction = undefined): Promise < MiningFarmEntity > {
        let newUris = [], oldUris = [];

        if (creditImages === true) {
            try {
                miningFarmEntity.coverImgUrl = await this.dataService.trySaveUri(miningFarmEntity.accountId, miningFarmEntity.coverImgUrl);
                miningFarmEntity.profileImgUrl = await this.dataService.trySaveUri(miningFarmEntity.accountId, miningFarmEntity.profileImgUrl);
                for (let i = miningFarmEntity.farmPhotoUrls.length; i-- > 0;) {
                    miningFarmEntity.farmPhotoUrls[i] = await this.dataService.trySaveUri(miningFarmEntity.accountId, miningFarmEntity.farmPhotoUrls[i]);
                }
            } catch (e) {
                throw new DataServiceError();
            }
            newUris = [miningFarmEntity.coverImgUrl, miningFarmEntity.profileImgUrl].concat(miningFarmEntity.farmPhotoUrls);
        }

        let miningFarmRepo = MiningFarmEntity.toRepo(miningFarmEntity);
        try {
            if (miningFarmEntity.isNew() === true) {
                miningFarmRepo = await this.miningFarmRepo.create(miningFarmRepo.toJSON(), {
                    returning: true,
                    transaction: tx,
                })
            } else {
                if (creditImages === true) {
                    const miningFarmRepoDb = await this.findMiningFarmById(miningFarmRepo.id, tx, tx.LOCK.UPDATE);
                    oldUris = [miningFarmRepoDb.coverImgUrl, miningFarmRepoDb.profileImgUrl].concat(miningFarmRepoDb.farmPhotoUrls);
                }

                const whereClause = new MiningFarmRepo();
                whereClause.id = miningFarmRepo.id;
                const sqlResult = await this.miningFarmRepo.update(miningFarmRepo.toJSON(), {
                    where: AppRepo.toJsonWhere(whereClause),
                    returning: true,
                    transaction: tx,
                })
                miningFarmRepo = sqlResult[1].length === 1 ? sqlResult[1][0] : null;
            }
            this.dataService.cleanUpOldUris(oldUris, newUris);
        } catch (ex) {
            this.dataService.cleanUpNewUris(oldUris, newUris);
            throw ex;
        }

        return MiningFarmEntity.fromRepo(miningFarmRepo);
    }

    async findMiners(): Promise < MinerEntity[] > {
        const minerRepos = await this.minerRepo.findAll();
        return minerRepos.map((minerEntity) => {
            return MinerEntity.fromRepo(minerEntity);
        });
    }

    async findEnergySources(): Promise < EnergySourceEntity[] > {
        const energySourceRepos = await this.energySourceRepo.findAll();
        return energySourceRepos.map((energySourceRepo) => {
            return EnergySourceEntity.fromRepo(energySourceRepo);
        });
    }

    async findManufacturers(): Promise < ManufacturerEntity[] > {
        const manufacturerRepos = await this.manufacturerRepo.findAll();
        return manufacturerRepos.map((manufacturerRepo) => {
            return ManufacturerEntity.fromRepo(manufacturerRepo);
        })
    }

    async creditEnergySource(energySourceEntity: EnergySourceEntity, tx: Transaction = undefined): Promise < EnergySourceEntity > {
        let energySourceRepo = EnergySourceEntity.toRepo(energySourceEntity);
        if (energySourceEntity.isNew() === true) {
            energySourceRepo = await this.energySourceRepo.create(energySourceRepo.toJSON(), {
                returning: true,
                transaction: tx,
            })
        } else {
            const whereClause = new EnergySourceRepo();
            whereClause.id = energySourceRepo.id;
            const sqlResult = await this.energySourceRepo.update(energySourceRepo.toJSON(), {
                where: AppRepo.toJsonWhere(whereClause),
                returning: true,
                transaction: tx,
            })
            energySourceRepo = sqlResult[1].length === 1 ? sqlResult[1][0] : null;
        }

        return EnergySourceEntity.fromRepo(energySourceRepo);
    }

    async creditMiner(minerEntity: MinerEntity, tx: Transaction = undefined): Promise < MinerEntity > {
        let minerRepo = MinerEntity.toRepo(minerEntity);
        console.log(1, minerRepo);
        if (minerEntity.isNew() === true) {
            console.log(2, minerRepo.toJSON());
            minerRepo = await this.minerRepo.create(minerRepo.toJSON(), {
                returning: true,
                transaction: tx,
            })
        } else {
            const whereClause = new MinerRepo();
            whereClause.id = minerRepo.id;
            const sqlResult = await this.minerRepo.update(minerRepo.toJSON(), {
                where: AppRepo.toJsonWhere(whereClause),
                returning: true,
                transaction: tx,
            })
            minerRepo = sqlResult[1].length === 1 ? sqlResult[1][0] : null;
        }

        console.log('back', minerRepo);
        return MinerEntity.fromRepo(minerRepo);
    }

    async creditManufacturer(manufacturerEntity: ManufacturerEntity, tx: Transaction = undefined): Promise < ManufacturerEntity > {
        let manufacturerRepo = ManufacturerEntity.toRepo(manufacturerEntity);
        if (manufacturerEntity.isNew() === true) {
            manufacturerRepo = await this.manufacturerRepo.create(manufacturerRepo.toJSON(), {
                returning: true,
                transaction: tx,
            })
        } else {
            const whereClause = new MinerRepo();
            whereClause.id = manufacturerRepo.id;
            const sqlResult = await this.manufacturerRepo.update(manufacturerRepo.toJSON(), {
                where: AppRepo.toJsonWhere(whereClause),
                returning: true,
                transaction: tx,
            })
            manufacturerRepo = sqlResult[1].length === 1 ? sqlResult[1][0] : null;
        }

        return ManufacturerEntity.fromRepo(manufacturerRepo);
    }

    async getDetails(farmId: number): Promise < MiningFarmDetailsEntity > {
        const miningFarmEntity = await this.findMiningFarmById(farmId)
        if (miningFarmEntity === null) {
            return null;
        }

        const collections = await this.collectionModel.findAll({ where: { farm_id: farmId, status: { [Op.notIn]: [CollectionStatus.DELETED] } } })

        // Get number of total and sold NFTs
        const nfts = await this.nftModel.findAll({ include: [{ model: Collection, where: { farm_id: farmId } }], where: { status: { [Op.notIn]: [NftStatus.REMOVED] } } })
        const soldNfts = nfts.filter((nft) => nft.token_id !== '')

        // Calculate remaining hash power of the farm
        const collectionsHashPowerSum = collections.reduce((prevVal, currVal) => prevVal + Number(currVal.hashing_power), 0)
        const remainingHashPowerInTH = miningFarmEntity.hashPowerInTh - collectionsHashPowerSum;

        const { activeWorkersCount, averageHashRateH1 } = await this.getFoundryFarmWorkersDetails(miningFarmEntity.legalName);

        const miningFarmDetailsEntity = new MiningFarmDetailsEntity();
        miningFarmDetailsEntity.miningFarmId = miningFarmEntity.id;
        miningFarmDetailsEntity.averageHashPowerInTh = averageHashRateH1;
        miningFarmDetailsEntity.activeWorkers = activeWorkersCount;
        miningFarmDetailsEntity.nftsOwned = nfts.length;
        miningFarmDetailsEntity.totalNftsSold = soldNfts.length;
        miningFarmDetailsEntity.remainingHashPowerInTH = remainingHashPowerInTH;

        return miningFarmDetailsEntity;
    }

    async getFoundryFarmWorkersDetails(subAccountName: string): Promise < { activeWorkersCount: number, averageHashRateH1: number } > {
        const workersDetails = {
            activeWorkersCount: 0,
            averageHashRateH1: 0,
        }
        try {
            const res = await this.httpService.axiosRef.get(`${process.env.App_Foundry_API}/subaccount_stats/${subAccountName}`, {
                headers: {
                    'x-api-key': process.env.App_Foundry_API_Auth_Token,
                },
            });

            workersDetails.activeWorkersCount = res.data.activeWorkers;
            workersDetails.averageHashRateH1 = res.data.hashrate1hrAvg;
        } catch (err) {
        }

        return workersDetails;
    }

}
