import S from '../../../../core/utilities/Main';
import { makeAutoObservable } from 'mobx';
import NftRepo from '../../../nft/presentation/repos/NftRepo';
import NftEntity, { NftListinStatus } from '../../entities/NftEntity';
import CollectionEntity from '../../../collection/entities/CollectionEntity';
import MiningFarmEntity from '../../../mining-farm/entities/MiningFarmEntity';
import BitcoinStore from '../../../bitcoin-data/presentation/stores/BitcoinStore';
import CudosStore from '../../../cudos-data/presentation/stores/CudosStore';

export default class NftDetailsStore {

    bitcoinStore: BitcoinStore;
    cudosStore: CudosStore;

    nftRepo: NftRepo;

    cudosPrice: number;
    bitcoinPrice: number;
    nftEntity: NftEntity;
    collectionEntity: CollectionEntity;
    miningFarm: MiningFarmEntity;

    constructor(bitcoinStore: BitcoinStore, cudosStore: CudosStore, nftRepo: NftRepo) {
        this.bitcoinStore = bitcoinStore;
        this.cudosStore = cudosStore;

        this.nftRepo = nftRepo;

        this.resetDefaults();

        makeAutoObservable(this);
    }

    resetDefaults() {
        this.cudosPrice = S.NOT_EXISTS;
        this.bitcoinPrice = S.NOT_EXISTS;
        this.nftEntity = null;
        this.collectionEntity = null;
        this.miningFarm = null;
    }

    async init(nftId: string) {
        await this.bitcoinStore.init();
        await this.cudosStore.init();

        // TODO: gt by real id
        const { nftEntity, collectionEntity, miningFarmEntity } = await this.nftRepo.fetchNftEntity(nftId);
        this.nftEntity = nftEntity;
        this.collectionEntity = collectionEntity;
        this.miningFarm = miningFarmEntity;

        this.cudosPrice = this.cudosStore.getCudosPrice();
        this.bitcoinPrice = this.bitcoinStore.getBitcoinPrice();
    }

    getNftPriceText() {
        if (this.isNftListed() === false) {
            return 'Not for sale';
        }

        return `${this.nftEntity.price.multipliedBy(this.cudosPrice).toFixed(2)}`;
    }

    isNftListed() {
        return this.nftEntity.listingStatus === NftListinStatus.LISTED;
    }

    isOwner(address: string) {
        return this.nftEntity.currentOwnerAddress === address;
    }
}
