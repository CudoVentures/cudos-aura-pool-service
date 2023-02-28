import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeModule } from '@nestjs/sequelize';
import { GraphqlModule } from '../graphql/graphql.module';
import { NFTModule } from './nft.module';
import { FarmModule } from '../farm/farm.module';
import { CollectionModule } from '../collection/collection.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/auth.types';
import compose from 'docker-compose';
import Path from 'path';
import { NftRepo } from './repos/nft.repo';
import { NFTService } from './nft.service';
import { VisitorModule } from '../visitor/visitor.module';
import { CoinGeckoModule } from '../coin-gecko/coin-gecko.module';
import NftEntity from './entities/nft.entity';
import CoinGeckoService from '../coin-gecko/coin-gecko.service';
import BigNumber from 'bignumber.js';

describe('NFTService', () => {
    const oneCudosInAcudos = new BigNumber('1000000000000000000')
    const testDbDockerPath = Path.join(process.cwd(), 'docker/test');
    let service: NFTService;
    let module: TestingModule;

    jest.setTimeout(6000000);

    beforeAll(async () => {
        await compose.upAll({
            cwd: testDbDockerPath,
        });

        module = await Test.createTestingModule({
            imports: [
                JwtModule.register({
                    secret: jwtConstants.secret,
                    signOptions: { expiresIn: '7d' },
                }),
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: ['./config/.env'],
                    load: [() => {
                        const Config = {};
                        Object.keys(process.env).forEach((envName) => {
                            const envNameUppercase = envName.toUpperCase();

                            if (envNameUppercase.startsWith('APP_') === false) {
                                return;
                            }

                            Config[envNameUppercase] = process.env[envName];
                        });

                        process.env['APP_PRESALE_COLLECTION_ID'] = '1';
                        return Config;
                    }],
                }),
                SequelizeModule.forRoot({
                    dialect: 'postgres',
                    host: 'host.docker.internal',
                    port: 15432,
                    username: 'postgres',
                    password: 'postgres',
                    database: 'aura_pool_test',
                    autoLoadModels: true,
                    synchronize: true,
                    logging: false,
                }),
                SequelizeModule.forFeature([
                    NftRepo,
                ]),
                NFTModule,
                CollectionModule,
                FarmModule,
                GraphqlModule,
                CoinGeckoModule,
                VisitorModule,
            ],
            providers: [
                NFTService,
            ],
        }).compile();

        await module.init();

        service = module.get<NFTService>(NFTService);
        const coinGeckoService = module.get<CoinGeckoService>(CoinGeckoService);
        jest.spyOn(coinGeckoService, 'fetchCudosPrice').mockImplementation(async () => {
            return {
                cudosUsdPrice: Number(1),
                cudosEthPrice: new BigNumber(1),
            }
        });

        process.env.APP_PRESALE_PRICE_USD = '1';
        process.env.APP_PRESALE_EXPECTED_PRICE_EPSILON = '0.01';
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await module.close();

        await compose.down({
            cwd: testDbDockerPath,
        });
    });

    it('Should be defined', async () => {
        expect(service).toBeDefined();
    });

    it('getRandomPresaleNft: should have expected distribution', async () => {
        // Arrange
        const totalFetches = 2000000;
        const tiers = [150, 300, 1000, 3000, 5000];
        const propabilities = [0.1912, 0.7527, 0.0498, 0.0046, 0.0017];
        const expectedCounts = propabilities.map((probality) => totalFetches * probality);

        const countE = 0.025;

        jest.spyOn(service, 'findAllPresaleByCollectionAndPriceUsd').mockImplementation(async (collectionId, price) => {
            const nftEntity = new NftEntity();
            nftEntity.priceUsd = price;
            return [nftEntity];
        });

        // Act
        const resultCounts = expectedCounts.map((_) => 0);
        for (let i = 0; i < totalFetches; i++) {
            const nftEntity = await service.getRandomPresaleNft(oneCudosInAcudos);
            const tier = tiers.indexOf(nftEntity.priceUsd);
            if (tier === -1) {
                throw new Error(`Unknown tier:${tier}`);
            }
            ++resultCounts[tier];
        }

        // Assert
        for (let i = 0; i < expectedCounts.length; ++i) {
            expect(expectedCounts[i] * (1 - countE) <= resultCounts[i] && resultCounts[i] <= expectedCounts[i] * (1 + countE)).toBeTruthy();
        }
    })

    it('getRandomPresaleNft: tier2 finished, tier1 should be minted instead', async () => {
        // Arrange
        const totalFetches = 2000000;
        const tiers = [150, 1000, 3000, 5000];
        const propabilities = [0.1912 + 0.7527, 0.0498, 0.0046, 0.0017];
        const expectedCounts = propabilities.map((probality) => totalFetches * probality);
        const countE = 0.025;

        jest.spyOn(service, 'findAllPresaleByCollectionAndPriceUsd').mockImplementation(async (collectionId, price) => {
            if (price === 300) {
                return [];
            }

            const nftEntity = new NftEntity();
            nftEntity.priceUsd = price;
            return [nftEntity];
        });

        // Act
        const resultCounts = expectedCounts.map((_) => 0);
        for (let i = 0; i < totalFetches; i++) {
            const nftEntity = await service.getRandomPresaleNft(oneCudosInAcudos);
            const tier = tiers.indexOf(nftEntity.priceUsd);
            if (tier === -1) {
                throw new Error(`Unknown tier:${tier}`);
            }
            ++resultCounts[tier];
        }

        // Assert
        for (let i = 0; i < expectedCounts.length; ++i) {
            expect(expectedCounts[i] * (1 - countE) <= resultCounts[i] && resultCounts[i] <= expectedCounts[i] * (1 + countE)).toBeTruthy();
        }
    })

    it('getRandomPresaleNft: tiers 2 and 1 finished, tier 3 should be minted instead of them', async () => {
        // Arrange
        const totalFetches = 2000000;
        const tiers = [1000, 3000, 5000];
        const propabilities = [0.1912 + 0.7527 + 0.0498, 0.0046, 0.0017];
        const expectedCounts = propabilities.map((probality) => totalFetches * probality);
        const countE = 0.025;

        jest.spyOn(service, 'findAllPresaleByCollectionAndPriceUsd').mockImplementation(async (collectionId, price) => {
            if (price === 150 || price === 300) {
                return [];
            }

            const nftEntity = new NftEntity();
            nftEntity.priceUsd = price;
            return [nftEntity];
        });

        // Act
        const resultCounts = expectedCounts.map((_) => 0);
        for (let i = 0; i < totalFetches; i++) {
            const nftEntity = await service.getRandomPresaleNft(oneCudosInAcudos);
            const tier = tiers.indexOf(nftEntity.priceUsd);
            if (tier === -1) {
                throw new Error(`Unknown tier:${tier}`);
            }
            ++resultCounts[tier];
        }

        // Assert
        for (let i = 0; i < expectedCounts.length; ++i) {
            expect(expectedCounts[i] * (1 - countE) <= resultCounts[i] && resultCounts[i] <= expectedCounts[i] * (1 + countE)).toBeTruthy();
        }
    })

    it('getRandomPresaleNft: payment amount outside epsilon', async () => {
        // Assert
        expect(await service.getRandomPresaleNft(oneCudosInAcudos.plus(oneCudosInAcudos))).toEqual(null);
    })

});
