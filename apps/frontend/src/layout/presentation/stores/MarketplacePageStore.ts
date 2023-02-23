import { makeAutoObservable, runInAction } from 'mobx';
import numeral from 'numeral';
import CollectionEntity from '../../../collection/entities/CollectionEntity';
import CollectionRepo from '../../../collection/presentation/repos/CollectionRepo';
import NftEntity from '../../../nft/entities/NftEntity';
import NftRepo, { BuyingCurrency } from '../../../nft/presentation/repos/NftRepo';
import MiningFarmEntity from '../../../mining-farm/entities/MiningFarmEntity';
import MiningFarmRepo from '../../../mining-farm/presentation/repos/MiningFarmRepo';
import CollectionDetailsEntity from '../../../collection/entities/CollectionDetailsEntity';
import DefaultIntervalPickerState from '../../../analytics/presentation/stores/DefaultIntervalPickerState';
import MiningFarmDetailsEntity from '../../../mining-farm/entities/MiningFarmDetailsEntity';
import ProjectUtils, { runInActionAsync } from '../../../core/utilities/ProjectUtils';
import CudosStore from '../../../cudos-data/presentation/stores/CudosStore';
import NftFilterModel from '../../../nft/utilities/NftFilterModel';
import WalletStore from '../../../ledger/presentation/stores/WalletStore';
import { PRESALE_CONSTS } from '../../../core/utilities/Constants';
import AlertStore from '../../../core/presentation/stores/AlertStore';
import PresaleStore from '../../../app-routes/presentation/PresaleStore';
import AllowlistRepo from '../../../allowlist/presentation/repos/AllowlistRepo';
import AllowlistUserEntity from '../../../allowlist/entities/AllowlistUserEntity';
import BigNumber from 'bignumber.js';

declare let Config;

export default class MarketplacePageStore {
    alertStore: AlertStore;
    cudosStore: CudosStore;
    walletStore: WalletStore;
    presaleStore: PresaleStore;

    collectionRepo: CollectionRepo;
    nftRepo: NftRepo;
    miningFarmRepo: MiningFarmRepo;
    allowlistRepo: AllowlistRepo;

    defaultIntervalPickerState: DefaultIntervalPickerState;

    presaleCollectionEntity: CollectionEntity;
    presaleCollectionDetailsEntity: CollectionDetailsEntity;
    presaleMintedNftCount: number;
    totalPresaleNftCount: number;
    presaleNftsUniqueImageUrls: string[];
    presaleNftIndexSelected: number;

    collectionMap: Map < string, CollectionEntity >;
    collectionDetailsMap: Map < string, CollectionDetailsEntity >;
    topCollectionEntities: CollectionEntity[];
    newNftDropsEntities: NftEntity[];
    trendingNftEntities: NftEntity[];
    popularFarmsEntities: MiningFarmEntity[];
    miningFarmDetailsMap: Map < string, MiningFarmDetailsEntity >;

    allowlistUserEntity: AllowlistUserEntity;
    totalWhitelistedUsersCount: number;

    constructor(presaleStore: PresaleStore, alertStore: AlertStore, walletStore: WalletStore, cudosStore: CudosStore, collectionRepo: CollectionRepo, nftRepo: NftRepo, miningFarmRepo: MiningFarmRepo, allowlistRepo: AllowlistRepo) {
        this.cudosStore = cudosStore;
        this.walletStore = walletStore;
        this.alertStore = alertStore;
        this.presaleStore = presaleStore;

        this.collectionRepo = collectionRepo;
        this.nftRepo = nftRepo;
        this.miningFarmRepo = miningFarmRepo;
        this.defaultIntervalPickerState = new DefaultIntervalPickerState(this.fetchTopCollections);
        this.allowlistRepo = allowlistRepo;

        this.presaleCollectionEntity = null;
        this.presaleCollectionDetailsEntity = null;
        this.presaleMintedNftCount = 0;
        this.totalPresaleNftCount = 0;
        this.presaleNftsUniqueImageUrls = ['/assets/presale-nft-images/level1.png', '/assets/presale-nft-images/level2.png', '/assets/presale-nft-images/level3.png', '/assets/presale-nft-images/level4.png', '/assets/presale-nft-images/level5.png'];
        this.presaleNftIndexSelected = 0;

        this.collectionMap = new Map();
        this.collectionDetailsMap = new Map();
        this.topCollectionEntities = [];
        this.newNftDropsEntities = [];
        this.trendingNftEntities = [];
        this.popularFarmsEntities = [];
        this.miningFarmDetailsMap = new Map();

        this.allowlistUserEntity = null;
        this.totalWhitelistedUsersCount = 0;

        makeAutoObservable(this);
    }

    async init() {
        this.presaleStore.update();

        if (this.isPresaleOver() === false) {
            this.cudosStore.init();
            this.fetchPresaleCollectionWithDetails();
            this.fetchTotalWhitelistedCount();
        } else {
            await this.fetchTopCollections();
            await this.fetchNewNftDrops();
            this.fetchTrendingNfts();
            this.fetchPopularFarms();
        }
    }

    fetchTopCollections = async () => {
        const topCollectionEntities = await this.collectionRepo.fetchTopCollections(this.defaultIntervalPickerState.earningsTimestampFrom, this.defaultIntervalPickerState.earningsTimestampTo);
        const collectionIds = topCollectionEntities.map((collectionEntity) => {
            return collectionEntity.id;
        });

        const collectionDetails = await this.collectionRepo.fetchCollectionsDetailsByIds(collectionIds);
        const collectionDetailsMap = new Map();
        collectionDetails.forEach((collectionDetailsEntity) => {
            collectionDetailsMap.set(collectionDetailsEntity.collectionId, collectionDetailsEntity);
        });

        this.addCollectionsToMap(topCollectionEntities);

        await runInActionAsync(() => {
            this.topCollectionEntities = topCollectionEntities;
            this.collectionDetailsMap = collectionDetailsMap;
        });
    }

    fetchPresaleCollectionWithDetails = async () => {
        const collectionId = Config.APP_PRESALE_COLLECTION_ID;
        const presaleCollection = await this.collectionRepo.fetchCollectionById(collectionId);
        const collectionDetails = await this.collectionRepo.fetchCollectionsDetailsByIds([collectionId]);

        const nftFilter = new NftFilterModel();
        nftFilter.collectionIds = [collectionId];
        const { totalPresaleNftCount, presaleMintedNftCount } = await this.nftRepo.fetchPresaleAmounts(nftFilter);

        await runInActionAsync(() => {
            this.presaleCollectionEntity = presaleCollection;
            this.presaleCollectionDetailsEntity = collectionDetails[0];

            this.totalPresaleNftCount = totalPresaleNftCount;
            this.presaleMintedNftCount = presaleMintedNftCount;
        })
    }

    async fetchNewNftDrops() {
        const newNftDropsEntities = await this.nftRepo.fetchNewNftDrops();
        this.fetchCollectionsForEntities(newNftDropsEntities);

        await runInActionAsync(() => {
            this.newNftDropsEntities = newNftDropsEntities;
        })
    }

    async fetchTrendingNfts() {
        const trendingNftEntities = await this.nftRepo.fetchTrendingNfts();
        this.fetchCollectionsForEntities(trendingNftEntities);

        await runInActionAsync(() => {
            this.trendingNftEntities = trendingNftEntities;
        });
    }

    async fetchPopularFarms() {
        const popularFarmsEntities = await this.miningFarmRepo.fetchPopularMiningFarms();

        const miningFarmIds = popularFarmsEntities.map((miningFarmEntity) => miningFarmEntity.id);

        const miningFarmDetailsEntities = await this.miningFarmRepo.fetchMiningFarmsDetailsByIds(miningFarmIds);
        const miningFarmDetailsMap = new Map();
        miningFarmDetailsEntities.forEach((miningFarmDetailsEntity) => {
            miningFarmDetailsMap.set(miningFarmDetailsEntity.miningFarmId, miningFarmDetailsEntity);
        });

        await runInActionAsync(() => {
            this.popularFarmsEntities = popularFarmsEntities;
            this.miningFarmDetailsMap = miningFarmDetailsMap;
        });
    }

    async fetchCollectionsForEntities(nftEntities: NftEntity[]) {
        const collectionIdsToFetch = nftEntities
            .filter((nftEntity: NftEntity) => this.collectionMap.has(nftEntity.collectionId) === false)
            .map((nftEntity: NftEntity) => nftEntity.collectionId);

        const fetchedCollections = await this.collectionRepo.fetchCollectionsByIds(collectionIdsToFetch);

        this.addCollectionsToMap(fetchedCollections);
    }

    addCollectionsToMap(collectionEntities: CollectionEntity[]) {
        collectionEntities.forEach((collectionEntity: CollectionEntity) => {
            this.collectionMap.set(collectionEntity.id, collectionEntity);
        })
    }

    getCollectionById(collectionId: string) {
        return this.collectionMap.get(collectionId);
    }

    getCollectionName(collectionId: string): string {
        return this.collectionMap.get(collectionId)?.name ?? '';
    }

    getMiningFarmDetailsEntity(miningFarmId: string): MiningFarmDetailsEntity {
        return this.miningFarmDetailsMap.get(miningFarmId) ?? null;
    }

    isPresaleOver(): boolean {
        return this.presaleStore.isInPresale() === false;
    }

    async fetchTotalWhitelistedCount(): Promise < void > {
        const count = await this.allowlistRepo.fetchTotalListedUsers();

        runInAction(() => {
            this.totalWhitelistedUsersCount = count;
        })
    }

    getPresaleTimeLeft(): {presaleDaysLeft: string, presaleHoursLeft: string, presaleMinutesLeft: string, presaleSecondsleft: string } {
        const ms = this.presaleStore.timeLeftToPresale;
        const presaleDaysLeft = Math.floor(ms / (24 * 60 * 60 * 1000));
        const daysms = ms % (24 * 60 * 60 * 1000);
        const presaleHoursLeft = Math.floor(daysms / (60 * 60 * 1000));
        const hoursms = ms % (60 * 60 * 1000);
        const presaleMinutesLeft = Math.floor(hoursms / (60 * 1000));
        const minutesms = ms % (60 * 1000);
        const presaleSecondsleft = Math.floor(minutesms / 1000);

        return {
            presaleDaysLeft: presaleDaysLeft < 10 ? `0${presaleDaysLeft}` : `${presaleDaysLeft}`,
            presaleHoursLeft: presaleHoursLeft < 10 ? `0${presaleHoursLeft}` : `${presaleHoursLeft}`,
            presaleMinutesLeft: presaleMinutesLeft < 10 ? `0${presaleMinutesLeft}` : `${presaleMinutesLeft}`,
            presaleSecondsleft: presaleSecondsleft < 10 ? `0${presaleSecondsleft}` : `${presaleSecondsleft}`,
        }
    }

    getPresaleTotalAmount(): number {
        return this.totalPresaleNftCount;
    }

    getPresaleMintedAmount(): number {
        return this.presaleMintedNftCount
    }

    getPresaleMintedPercent(): number {
        const total = this.getPresaleTotalAmount();
        if (total === 0) {
            return 0;
        }

        return (this.getPresaleMintedAmount() * 100) / total;
    }

    isUserEligibleToBuy(): boolean {
        if (this.walletStore.isConnected() === false) {
            return false;
        }

        if (this.allowlistUserEntity === null) {
            return false;
        }

        return true;
    }

    async fetchAllowlistUser(): Promise < void > {
        let allowlistUserEntity;
        if (this.presaleStore.isInPresale() === true) {
            allowlistUserEntity = await this.allowlistRepo.fetchAllowlistUserBySessionAccount();
        } else {
            allowlistUserEntity = new AllowlistUserEntity(); // it just has to be != null in order to allow payment
        }

        runInAction(() => {
            this.allowlistUserEntity = allowlistUserEntity;
        });
    }

    private getPresalePriceInCudos(): BigNumber {
        const price = this.cudosStore.convertUsdInCudos(PRESALE_CONSTS.PRICE_USD);
        return price.plus(ProjectUtils.ON_DEMAND_MINTING_SERVICE_FEE_IN_CUDOS);
    }

    private getPresalePriceInEth(): BigNumber {
        return this.cudosStore.convertCudosToEth(this.getPresalePriceInCudos());
    }

    getPresalePriceCudosFormatted(): string {
        return this.getPresalePriceInCudos().toFixed(2);
    }

    getPresalePriceEthFormatted(): string {
        return this.getPresalePriceInEth().toFixed(6);
    }

    getPresalePriceUsdFormatted(): string {
        const onDemandMintingFeeInUsd = this.cudosStore.convertCudosInUsd(ProjectUtils.ON_DEMAND_MINTING_SERVICE_FEE_IN_CUDOS);
        const presalePriceInUsd = onDemandMintingFeeInUsd.plus(new BigNumber(PRESALE_CONSTS.PRICE_USD));
        return numeral(presalePriceInUsd.toFixed(2)).format(ProjectUtils.NUMERAL_USD);
    }

    async onClickBuyWithCudos(): Promise < boolean > {
        try {
            const cudosBalance = await this.walletStore.getBalanceSafe();
            const cudosPrice = this.getPresalePriceInCudos()

            if (cudosBalance.lt(cudosPrice)) {
                this.alertStore.show('Your balance is not enough to buy this.');
                return false;
            }

            await this.nftRepo.buyPresaleNft(BuyingCurrency.CUDOS, cudosPrice, this.walletStore.ledger);
            return true;
        } catch (e) {
            this.alertStore.show(e.message);
            return false;
        }
    }

    async onClickBuyWithEth(): Promise < boolean > {
        try {
            const ethBalance = await this.walletStore.getEthBalance();

            const ethPrice = this.getPresalePriceInEth()

            if (ethBalance.lt(ethPrice)) {
                this.alertStore.show('Your balance is not enough to buy this.');
                return false;
            }

            await this.nftRepo.buyPresaleNft(BuyingCurrency.ETH, ethPrice, this.walletStore.ledger);
            return true;
        } catch (e) {
            this.alertStore.show(e.message);
            return false;
        }
    }

    getPresaleNftPicture() {
        return this.presaleNftsUniqueImageUrls[this.presaleNftIndexSelected];
    }

    onClickNextPresaleNftPicture = () => {
        this.presaleNftIndexSelected = this.presaleNftIndexSelected < this.presaleNftsUniqueImageUrls.length - 1 ? this.presaleNftIndexSelected + 1 : 0;
    }

    onClickPreviousPresaleNftPicture = () => {
        this.presaleNftIndexSelected = this.presaleNftIndexSelected === 0 ? this.presaleNftsUniqueImageUrls.length - 1 : this.presaleNftIndexSelected - 1;
    }
}
