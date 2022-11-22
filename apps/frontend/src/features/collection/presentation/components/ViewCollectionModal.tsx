import React, { useEffect, useState } from 'react';
import { inject, observer } from 'mobx-react';

import ProjectUtils from '../../../../core/utilities/ProjectUtils';
import ViewCollectionModalStore from '../stores/ViewCollectionModalStore';

import ModalWindow from '../../../../core/presentation/components/ModalWindow';
import DataPreviewLayout, { createDataPreview, DataRowsSize } from '../../../../core/presentation/components/DataPreviewLayout';

import '../styles/view-collection-modal.css';
import Actions, { ActionsLayout } from '../../../../core/presentation/components/Actions';
import Button from '../../../../core/presentation/components/Button';
import AlertStore from '../../../../core/presentation/stores/AlertStore';
import Input, { InputType } from '../../../../core/presentation/components/Input';
import InputAdornment from '@mui/material/InputAdornment/InputAdornment';

type Props = {
    viewCollectionModalStore?: ViewCollectionModalStore;
    alertStore?: AlertStore
}

function ViewCollectionModal({ viewCollectionModalStore, alertStore }: Props) {

    const { collectionEntity, nftEntities } = viewCollectionModalStore;

    async function saveChanges() {
        await viewCollectionModalStore.saveChanges();
    }

    return (
        <ModalWindow
            className = { 'ViewCollectionModal' }
            modalStore = { viewCollectionModalStore } >

            { viewCollectionModalStore.visible === true && (
                <>
                    <DataPreviewLayout
                        dataPreviews = { [
                            createDataPreview('Collection Name', collectionEntity.name),
                            createDataPreview('Description', collectionEntity.description),
                            createDataPreview('Hashing Power for collection', collectionEntity.formatHashPowerInTh()),
                            createDataPreview(
                                'Collection Royalties',
                                <Input
                                    className={'FlexRow RoyaliesInput'}
                                    value = { viewCollectionModalStore.editedRoyalties }
                                    onChange = { viewCollectionModalStore.setRoyalties }
                                    inputType = {InputType.INTEGER}
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end" >
                                            BTC
                                        </InputAdornment>,
                                    }}
                                />,
                            ),
                        ] } />
                    { nftEntities.map((nftEntity) => {
                        return (
                            <div key = { nftEntity.id } className = { 'NftEntity' } >
                                <div
                                    className = { 'NftPreview ImgContainNode' }
                                    style = { ProjectUtils.makeBgImgStyle(nftEntity.imageUrl) } />
                                <DataPreviewLayout
                                    className = { 'DataPreviewLayout' }
                                    size = { DataRowsSize.SMALL }
                                    dataPreviews = { [
                                        createDataPreview('NFT Name', nftEntity.name),
                                        createDataPreview('Hash power', nftEntity.formatHashPowerInTh()),
                                        createDataPreview('Price', nftEntity.formatPriceInCudos()),
                                        createDataPreview('Expirity Date', nftEntity.formatExpiryDate()),
                                        createDataPreview('Creator address', nftEntity.creatorAddress),
                                        createDataPreview('Current owner', nftEntity.currentOwnerAddress),
                                    ] } />
                            </div>
                        )
                    })}

                    <Actions className = { 'ViewCollectionsActions' } layout = { ActionsLayout.LAYOUT_COLUMN_CENTER } >
                        <Button
                            disabled = { !viewCollectionModalStore.areChangesMade() }
                            onClick = { saveChanges } >
                            Save Changes
                        </Button>
                    </Actions>
                </>
            ) }

        </ModalWindow>
    )

}

export default inject((stores) => stores)(observer(ViewCollectionModal));
