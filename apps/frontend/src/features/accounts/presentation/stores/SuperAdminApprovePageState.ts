import RepoStore from '../../../../core/presentation/stores/RepoStore';
import TableStore from '../../../../core/presentation/stores/TableStore';
import { makeAutoObservable } from 'mobx';
import CollectionEntity, { CollectionStatus } from '../../../collection/entities/CollectionEntity';
import CollectionFilterModel from '../../../collection/utilities/CollectionFilterModel';
import MiningFarmEntity, { MiningFarmStatus } from '../../../mining-farm/entities/MiningFarmEntity';
import MiningFarmFilterModel from '../../../mining-farm/utilities/MiningFarmFilterModel';
import S from '../../../../core/utilities/Main';

export default class SuperAdminApprovePageState {
    repoStore: RepoStore;

    miningFarmsTableState: TableStore;
    collectionsTableState: TableStore;

    miningFarmEntities: MiningFarmEntity[];
    collectionEntities: CollectionEntity[];

    selectedMiningFarmEntities: Map < string, MiningFarmEntity >;
    selectedCollectionEntities: Map < string, CollectionEntity >;

    constructor(repoStore: RepoStore) {
        this.repoStore = repoStore;

        this.miningFarmsTableState = new TableStore(0, [], this.fetchMiningFarmEntities, 5);
        this.collectionsTableState = new TableStore(0, [], this.fetchCollectionEntities, 5);

        this.miningFarmEntities = [];
        this.collectionEntities = [];

        this.selectedMiningFarmEntities = new Map < string, MiningFarmEntity >();
        this.selectedCollectionEntities = new Map < string, CollectionEntity >();

        makeAutoObservable(this);
    }

    init(): void {
        this.miningFarmEntities = [];
        this.collectionEntities = [];

        this.selectedMiningFarmEntities = new Map < string, MiningFarmEntity >();
        this.selectedCollectionEntities = new Map < string, CollectionEntity >();

        this.fetch();
    }

    fetch(): void {
        this.fetchMiningFarmEntities();
        this.fetchCollectionEntities();
    }

    fetchMiningFarmEntities = (): void => {
        const miningFarmFilter = new MiningFarmFilterModel();
        miningFarmFilter.from = this.miningFarmsTableState.tableState.from;
        miningFarmFilter.count = this.miningFarmsTableState.tableState.itemsPerPage;
        miningFarmFilter.status = MiningFarmStatus.NOT_APPROVED;

        this.repoStore.miningFarmRepo.fetchMiningFarmsByFilter(miningFarmFilter).then(({ miningFarmEntities, total }) => {
            this.miningFarmEntities = miningFarmEntities;
            this.miningFarmsTableState.tableState.total = total;
        });

    }

    fetchCollectionEntities = (): void => {
        const collectionFilter = new CollectionFilterModel();
        collectionFilter.from = this.collectionsTableState.tableState.from;
        collectionFilter.count = this.collectionsTableState.tableState.itemsPerPage;
        collectionFilter.status = CollectionStatus.QUEUED;

        this.repoStore.collectionRepo.fetchCollectionsByFilter(collectionFilter).then(({ collectionEntities, total }) => {
            this.collectionEntities = collectionEntities;
            this.collectionsTableState.tableState.total = total;
        });

    }

    isMiningFarmEntitySelected(miningFarmId: string): number {
        return this.selectedMiningFarmEntities.has(miningFarmId) ? S.INT_TRUE : S.INT_FALSE;
    }

    isCollectionEntitySelected(collectionId: string): number {
        return this.selectedCollectionEntities.has(collectionId) ? S.INT_TRUE : S.INT_FALSE;
    }

    toggleMiningFarmSelection(miningFarmId: string) {
        if (this.selectedMiningFarmEntities.has(miningFarmId)) {
            this.selectedMiningFarmEntities.delete(miningFarmId);
        } else {
            const miningFarmEntity = this.miningFarmEntities.find((entity: MiningFarmEntity) => { return entity.id === miningFarmId });
            this.selectedMiningFarmEntities.set(miningFarmId, miningFarmEntity);
        }
    }

    toggleCollectionSelection(collectionId: string) {
        if (this.selectedCollectionEntities.has(collectionId)) {
            this.selectedCollectionEntities.delete(collectionId);
        } else {
            const collectionEntity = this.collectionEntities.find((entity: CollectionEntity) => { return entity.id === collectionId });
            this.selectedCollectionEntities.set(collectionId, collectionEntity);
        }
    }

    approveMiningFarms = async () => {
        const miningFarmEntities = [];

        this.selectedMiningFarmEntities.forEach((miningFarmEntity) => {
            miningFarmEntity.markApproved();
            miningFarmEntities.push(miningFarmEntity)
        });

        await this.repoStore.miningFarmRepo.creditMiningFarms(miningFarmEntities);
        this.fetch();
    }

    approveCollections = async () => {
        const collectionEntities = [];

        this.selectedCollectionEntities.forEach((collectionEntity) => {
            collectionEntity.markApproved();
            collectionEntities.push(collectionEntity);
        });

        for (let i = collectionEntities.length; i-- > 0;) {
            await this.repoStore.collectionRepo.creditCollection(collectionEntities[i], null);
        }

        this.fetch();
    }

}
