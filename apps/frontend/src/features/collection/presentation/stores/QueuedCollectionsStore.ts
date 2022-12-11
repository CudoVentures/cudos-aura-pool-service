import { makeAutoObservable } from 'mobx';
import AlertStore from '../../../../core/presentation/stores/AlertStore';
import TableState from '../../../../core/presentation/stores/TableState';
import AccountSessionStore from '../../../accounts/presentation/stores/AccountSessionStore';
import WalletStore from '../../../ledger/presentation/stores/WalletStore';
import CollectionDetailsEntity from '../../entities/CollectionDetailsEntity';
import CollectionEntity, { CollectionStatus } from '../../entities/CollectionEntity';
import CollectionFilterModel from '../../utilities/CollectionFilterModel';
import CollectionRepo from '../repos/CollectionRepo';

export default class QueuedCollectionsStore {

    collectionRepo: CollectionRepo;
    walletStore: WalletStore;
    accountSessionStore: AccountSessionStore;
    alertStore: AlertStore;

    collectionsTableState: TableState;

    collectionEntities: CollectionEntity[];
    collectionDetailsMap: Map < string, CollectionDetailsEntity >;

    constructor(collectionRepo: CollectionRepo, walletStore: WalletStore, accountSessionStore: AccountSessionStore, alertStore: AlertStore) {
        this.collectionRepo = collectionRepo;
        this.walletStore = walletStore;
        this.accountSessionStore = accountSessionStore;
        this.alertStore = alertStore;

        this.collectionsTableState = new TableState(0, [], this.fetchCollectionEntities, 8);

        this.collectionEntities = null;
        this.collectionDetailsMap = null;

        makeAutoObservable(this);
    }

    init(itemsPerPage: number) {
        this.collectionsTableState.tableFilterState.from = 0;
        this.collectionsTableState.tableFilterState.itemsPerPage = itemsPerPage;
        this.fetchCollectionEntities();
    }

    async fetchCollectionEntities() {
        const collectionFilter = new CollectionFilterModel();
        collectionFilter.from = this.collectionsTableState.tableFilterState.from;
        collectionFilter.count = this.collectionsTableState.tableFilterState.itemsPerPage;
        collectionFilter.status = CollectionStatus.QUEUED;

        const { collectionEntities, total } = await this.collectionRepo.fetchCollectionsByFilter(collectionFilter);
        if (collectionEntities.length === 0 && collectionFilter.from > 0) {
            this.collectionsTableState.tableFilterState.pageBack();
            this.fetchCollectionEntities();
            return;
        }

        const collectionIds = collectionEntities.map((collectionEntity) => {
            return collectionEntity.id;
        });
        const collectionDetails = await this.collectionRepo.fetchCollectionsDetailsByIds(collectionIds);
        const collectionDetailsMap = new Map();
        collectionDetails.forEach((collectionDetailsEntity) => {
            collectionDetailsMap.set(collectionDetailsEntity.collectionId, collectionDetailsEntity);
        });

        this.collectionEntities = collectionEntities;
        this.collectionDetailsMap = collectionDetailsMap;
        this.collectionsTableState.tableFilterState.total = total;
    }

    getCollectionDetails(collectionId: string): CollectionDetailsEntity | null {
        return this.collectionDetailsMap.get(collectionId) ?? null;
    }

    approveCollection(collectionEntity: CollectionEntity) {
        collectionEntity.markApproved();
        this.editCollectionStatus(collectionEntity);
    }

    rejectCollection(collectionEntity: CollectionEntity) {
        collectionEntity.markDeleted();
        this.editCollectionStatus(collectionEntity);
    }

    private async editCollectionStatus(collectionEntity: CollectionEntity) {
        if (this.walletStore.isConnected() === false) {
            this.alertStore.show('You must connect your wallet first');
            return;
        }

        try {
            await this.collectionRepo.approveCollection(collectionEntity, this.accountSessionStore.superAdminEntity, this.walletStore.ledger);
            await this.fetchCollectionEntities();
        } catch (e) {
            this.alertStore.show(e.message);
        }
    }

}
