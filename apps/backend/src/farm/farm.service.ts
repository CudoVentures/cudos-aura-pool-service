import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CollectionRepo } from '../collection/repos/collection.repo';
import { NftRepo } from '../nft/repos/nft.repo';
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
        @InjectModel(CollectionRepo)
        private collectionModel: typeof CollectionRepo,
        @InjectModel(NftRepo)
        private nftRepo: typeof NftRepo,
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

    async getDetails(farmId: number): Promise <{ id: number, subAccountName: string, totalHashRate: number, nftsOwned: number, nftsSold: number, remainingHashPowerInTH: number }> {
        const farm = await this.miningFarmRepo.findByPk(farmId)
        if (!farm) {
            throw new NotFoundException(`Farm with id '${farmId}' doesn't exist`)
        }

        const collections = await this.collectionModel.findAll({ where: { farm_id: farmId, status: { [Op.notIn]: [CollectionStatus.DELETED] } } })

        // Get number of total and sold NFTs
        const nfts = await this.nftRepo.findAll({ include: [{ model: CollectionRepo, where: { farm_id: farmId } }], where: { status: { [Op.notIn]: [NftStatus.REMOVED] } } })
        const soldNfts = nfts.filter((nft) => nft.tokenId !== '')

        // Calculate remaining hash power of the farm
        const collectionsHashPowerSum = collections.reduce((prevVal, currVal) => prevVal + Number(currVal.hashing_power), 0)
        const remainingHashPowerInTH = farm.total_farm_hashrate - collectionsHashPowerSum

        return {
            id: farmId,
            subAccountName: farm.sub_account_name,
            totalHashRate: farm.total_farm_hashrate,
            nftsOwned: nfts.length,
            nftsSold: soldNfts.length,
            remainingHashPowerInTH,
        }
    }

    async getFoundryFarmWorkersDetails(subAccountName: string): Promise<{ activeWorkersCount: number, averageHashRateH1: number }> {
        // TODO: Iterate if there are more than 100 workers
        try {
            const res = await this.httpService.axiosRef.get(`${process.env.App_Foundry_API}/subaccount_stats/${subAccountName}`, {
                headers: {
                    'x-api-key': process.env.App_Foundry_API_Auth_Token,
                },
            });

            const workersDetails = {
                activeWorkersCount: res.data.activeWorkers,
                averageHashRateH1: res.data.hashrate1hrAvg,
            };

            return workersDetails;
        } catch (err) {
            const workersDetails = {
                activeWorkersCount: 0,
                averageHashRateH1: 0,
            };

            return workersDetails
        }
    }

    private readonly foundryWorkersDetailsURI = 'coin=BTC&sort=highestHashrate&status=all&tag=all&pageNumber=0&pageSize=100&workerNameSearchStr=';
}
