import CollectionPreview from '../../entities/CollectionPreview';
import CollectionProfile from '../../entities/CollectionProfile';

export default interface CollectionRepo {

    getCategories(callback: (categories: string[]) => void);

    getTopCollections(period: number, callback: (collections: CollectionPreview[]) => void);

    getAllCollections(callback: (collections: CollectionPreview[]) => void);

    getCollectionProfile(collectionId: string, callback: (collection: CollectionProfile) => void);

    getCollectionsByFarmIdSortedPaginated(farmId: string, sortKey: string, from: number, count: number, callBack: (collectionPreviews: CollectionPreview[], total: number) => void);
}
