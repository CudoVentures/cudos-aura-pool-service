import { NOT_EXISTS_INT } from '../../common/utils';
import { CollectionJsonValidator } from '../collection.types';
import { CollectionRepo } from '../repos/collection.repo';
import { CollectionStatus } from '../utils';

export class CollectionEntity {
    id: number;
    name: string;
    description: string;
    denomId: string;
    hashingPower: number;
    royalties: number;
    mainImage: string;
    bannerImage: string;
    status: CollectionStatus;
    farmId: number;
    creatorId: number;
    timestampDeletedAt: number;

    constructor() {
        this.id = NOT_EXISTS_INT;
        this.name = '';
        this.description = '';
        this.denomId = '';
        this.hashingPower = NOT_EXISTS_INT;
        this.royalties = NOT_EXISTS_INT;
        this.mainImage = '';
        this.bannerImage = '';
        this.status = CollectionStatus.QUEUED;
        this.farmId = NOT_EXISTS_INT;
        this.creatorId = NOT_EXISTS_INT;
        this.timestampDeletedAt = NOT_EXISTS_INT;
    }

    isNew(): boolean {
        return this.id === NOT_EXISTS_INT;
    }

    static toRepo(entity: CollectionEntity): CollectionRepo {
        if (entity === null) {
            return null;
        }

        const repoJson = new CollectionRepo();

        if (entity.isNew() === false) {
            repoJson.id = entity.id;
        }

        repoJson.name = entity.name;
        repoJson.description = entity.description;
        repoJson.denomId = entity.denomId;
        repoJson.hashingPower = entity.hashingPower;
        repoJson.royalties = entity.royalties;
        repoJson.mainImage = entity.mainImage;
        repoJson.bannerImage = entity.bannerImage;
        repoJson.status = entity.status;
        repoJson.farmId = entity.farmId;
        repoJson.creatorId = entity.creatorId;
        repoJson.deletedAt = new Date(entity.timestampDeletedAt);

        return repoJson;
    }

    static fromRepo(repoJson: CollectionRepo): CollectionEntity {
        if (repoJson === null) {
            return null;
        }

        const entity = new CollectionEntity();

        entity.id = repoJson.id ?? entity.id;
        entity.name = repoJson.name ?? entity.name;
        entity.description = repoJson.description ?? entity.description;
        entity.denomId = repoJson.denomId ?? entity.denomId;
        entity.hashingPower = repoJson.hashingPower ?? entity.hashingPower;
        entity.royalties = repoJson.royalties ?? entity.royalties;
        entity.mainImage = repoJson.mainImage ?? entity.mainImage;
        entity.bannerImage = repoJson.bannerImage ?? entity.bannerImage;
        entity.farmId = repoJson.farmId ?? entity.farmId;
        entity.creatorId = repoJson.creatorId ?? entity.creatorId;
        entity.timestampDeletedAt = repoJson.deletedAt?.getTime() ?? entity.timestampDeletedAt;

        return entity;
    }

    static toJson(entity: CollectionEntity): CollectionJsonValidator {
        if (entity === null) {
            return null;
        }

        return {
            'id': entity.id.toString(),
            'name': entity.name,
            'description': entity.description,
            'denomId': entity.denomId,
            'hashingPower': entity.hashingPower,
            'royalties': entity.royalties,
            'mainImage': entity.mainImage,
            'bannerImage': entity.bannerImage,
            'farmId': entity.farmId.toString(),
            'creatorId': entity.creatorId.toString(),
            'timestampDeletedAt': entity.timestampDeletedAt,
        }
    }

    static fromJson(json: CollectionJsonValidator): CollectionEntity {
        if (json === null) {
            return null;
        }

        const entity = new CollectionEntity();

        entity.id = parseInt(json.id ?? entity.id.toString());
        entity.name = json.name ?? entity.name;
        entity.description = json.description ?? entity.description;
        entity.denomId = json.denomId ?? entity.denomId;
        entity.hashingPower = json.hashingPower ?? entity.hashingPower;
        entity.royalties = json.royalties ?? entity.royalties;
        entity.mainImage = json.mainImage ?? entity.mainImage;
        entity.bannerImage = json.bannerImage ?? entity.bannerImage;
        entity.farmId = parseInt(json.farmId ?? entity.farmId.toString());
        entity.creatorId = parseInt(json.creatorId ?? entity.creatorId.toString());

        return entity;
    }

}
