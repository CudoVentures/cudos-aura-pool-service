/* global TR */

import React, { useEffect, useState } from 'react';
import { inject, observer } from 'mobx-react';
import { useNavigate, useParams } from 'react-router-dom';

import ProjectUtils from '../../../../core/utilities/ProjectUtils';
import AppRoutes from '../../../app-routes/entities/AppRoutes';
import NftEntity from '../../../nft/entities/NftEntity';
import NftFilterModel from '../../../nft/utilities/NftFilterModel';

import { MenuItem } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import ProfileHeader from '../components/ProfileHeader';
import Breadcrumbs from '../../../../core/presentation/components/Breadcrumbs';
import PageLayoutComponent from '../../../../core/presentation/components/PageLayoutComponent';
import Svg from '../../../../core/presentation/components/Svg';
import PageHeader from '../../../header/presentation/components/PageHeader';
import PageFooter from '../../../footer/presentation/components/PageFooter';
import LoadingIndicator from '../../../../core/presentation/components/LoadingIndicator';
import Select from '../../../../core/presentation/components/Select';
import Actions, { ACTIONS_HEIGHT, ACTIONS_LAYOUT } from '../../../../core/presentation/components/Actions';
import Button, { BUTTON_PADDING, BUTTON_RADIUS, BUTTON_TYPE } from '../../../../core/presentation/components/Button';
import GridView from '../../../../core/presentation/components/GridView';
import NftPreview from '../../../nft/presentation/components/NftPreview';
import AddIcon from '@mui/icons-material/Add';
import '../styles/page-credit-collection-nfts.css';
import AccountSessionStore from '../../../accounts/presentation/stores/AccountSessionStore';
import { CollectionStatus } from '../../entities/CollectionEntity';
import AppStore from '../../../../core/presentation/stores/AppStore';
import AddNftsStage from '../components/collection-creation/AddNftsStage';
import CreditCollectionNftsPageStore from '../stores/CreditCollectionNftsPageStore';

type Props = {
    accountSessionStore?: AccountSessionStore
    appStore?: AppStore
    creditCollectionNftsPageStore?: CreditCollectionNftsPageStore,
}

function CreditCollectionNftsPage({ appStore, accountSessionStore, creditCollectionNftsPageStore }: Props) {

    const { collectionId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        appStore.useLoading(async () => {
            await creditCollectionNftsPageStore.init(collectionId);
        })
    }, []);

    // TODO: get crumbs from router
    const crumbs = [
        { name: 'My Collections', onClick: () => { navigate(AppRoutes.USER_PROFILE) } },
        { name: 'Create Collection' },
    ]

    return (
        <PageLayoutComponent
            className = { 'PageCreditCollectionNfts' }>
            <PageHeader />
            <div className={'PageContent AppContent'} >
                <Breadcrumbs crumbs={crumbs} />
                {/* <AddNftsStage /> */}
            </div>
            <PageFooter />
        </PageLayoutComponent>

    )
}

export default inject((stores) => stores)(observer(CreditCollectionNftsPage));
