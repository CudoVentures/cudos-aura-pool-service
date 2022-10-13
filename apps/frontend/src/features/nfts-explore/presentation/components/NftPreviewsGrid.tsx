import { MenuItem } from '@mui/material';
import { inject, observer } from 'mobx-react';
import React, { useEffect } from 'react'
import Actions, { ACTIONS_HEIGHT, ACTIONS_LAYOUT } from '../../../../core/presentation/components/Actions';
import Button, { BUTTON_PADDING, BUTTON_TYPE } from '../../../../core/presentation/components/Button';
import NftPreview from './NftPreview';
import Select from '../../../../core/presentation/components/Select';
import NftPreviewModel from '../../entities/NftPreviewModel'
import NftPreviewsGridStore from '../stores/NftPreviewsGridStore';
import '../styles/nft-preview-grid.css';

import GridView from '../../../../core/presentation/components/GridView';

interface Props {
    nftPreviewsGridStore?: NftPreviewsGridStore;
}

function NftPreviewsGrid({nftPreviewsGridStore}: Props) {
    useEffect(() => {
        nftPreviewsGridStore.innitialLoad();
    }, [])

    const store = nftPreviewsGridStore;

    return (
        <div className={'NftModelsViewerTable'}>
            <div className={'Grid FilterHeader'}>
                <Select
                    className={'SortBySelect'}
                    onChange={store.setSortByIndex}
                    value={store.selectedSortIndex}
                >
                    {NftPreviewsGridStore.TABLE_KEYS.map(
                        (key: string, index: number) => <MenuItem key={index} value={index}>{key}</MenuItem>,
                    )}
                </Select>
                <Actions
                    layout={ACTIONS_LAYOUT.LAYOUT_ROW_RIGHT}
                    height={ACTIONS_HEIGHT.HEIGHT_48}
                >
                    {/* TODO: show all filters */}
                    <Button
                        padding={BUTTON_PADDING.PADDING_24}
                        type={BUTTON_TYPE.ROUNDED}
                    >
                        All Filters
                    </Button>
                </Actions>
            </div>
            <GridView 
                gridViewStore={nftPreviewsGridStore.gridViewStore}
                defaultContent={<div className={'NoContentFound'}>No Nfts found</div>}
            >
                    {store.nftPreviews.map(
                        (nftPreviewModel: NftPreviewModel, index: number) => <NftPreview
                            key={index}
                            nftPreviewModel={nftPreviewModel}
                        />,
                    )}
            </GridView>
        </div>
    )
}

export default inject((stores) => stores)(observer(NftPreviewsGrid));
