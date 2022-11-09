import { CollectionStatus } from '../../../collection/entities/CollectionEntity';
import NftEntity from '../../entities/NftEntity';
import NftRepo from '../../presentation/repos/NftRepo';
import NftFilterModel from '../../utilities/NftFilterModel';
import NftApi from '../data-sources/NftApi';

export default class NftApiRepo implements NftRepo {

    nftApi: NftApi;
    enableActions: () => void;
    disableActions: () => void;

    constructor() {
        this.nftApi = new NftApi();
        this.enableActions = null;
        this.disableActions = null;
    }

    setPresentationCallbacks(enableActions: () => void, disableActions: () => void) {
        this.enableActions = enableActions;
        this.disableActions = disableActions;
    }

    async fetchNftById(nftId: string, status: CollectionStatus = CollectionStatus.APPROVED): Promise < NftEntity > {
        const nftEntities = await this.fetchNftByIds([nftId], status);
        return nftEntities.length === 1 ? nftEntities[0] : null;
    }

    async fetchNftByIds(nftIds: string[], status: CollectionStatus = CollectionStatus.APPROVED): Promise < NftEntity[] > {
        const nftFilterModel = new NftFilterModel();
        nftFilterModel.nftIds = nftIds;
        nftFilterModel.collectionStatus = status;

        const { nftEntities, total } = await this.fetchNftsByFilter(nftFilterModel);
        return nftEntities;
    }

    async fetchNewNftDrops(status: CollectionStatus = CollectionStatus.APPROVED): Promise < NftEntity[] > {
        const nftFilterModel = new NftFilterModel();
        // TO DO: sort by newest
        nftFilterModel.collectionStatus = status;

        const { nftEntities, total } = await this.fetchNftsByFilter(nftFilterModel);
        return nftEntities;
    }

    async fetchTrendingNfts(status: CollectionStatus = CollectionStatus.APPROVED): Promise < NftEntity[] > {
        const nftFilterModel = new NftFilterModel();
        // TO DO: sort by trending
        nftFilterModel.collectionStatus = status;

        const { nftEntities, total } = await this.fetchNftsByFilter(nftFilterModel);
        return nftEntities;
    }

    async fetchNftsByFilter(nftFilterModel: NftFilterModel): Promise < { nftEntities: NftEntity[], total: number } > {
        try {
            this.disableActions?.();
            return this.nftApi.fetchNftsByFilter(nftFilterModel);
        } finally {
            this.enableActions?.();
        }
    }
}
