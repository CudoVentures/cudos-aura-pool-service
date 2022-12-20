import React, { useEffect } from 'react';
import { inject, observer } from 'mobx-react';

import AccountSessionStore from '../stores/AccountSessionStore';
import AppStore from '../../../../core/presentation/stores/AppStore';
import UserProfilePageStore from '../stores/UserProfilePageStore';
import BitcoinStore from '../../../bitcoin-data/presentation/stores/BitcoinStore';
import EditUserModalStore from '../stores/EditUserModalStore';

import ProfileHeader from '../../../collection/presentation/components/ProfileHeader';
import PageLayoutComponent from '../../../../core/presentation/components/PageLayoutComponent';
import PageHeader from '../../../header/presentation/components/PageHeader';
import PageFooter from '../../../footer/presentation/components/PageFooter';
import AnimationContainer from '../../../../core/presentation/components/AnimationContainer';
import MyEarningsTab from '../components/user-profile/MyEarningsTab';
import MyHistoryTab from '../components/user-profile/MyHistoryTab';
import NavRowTabs, { createNavRowTab } from '../../../../core/presentation/components/NavRowTabs';
import MyNftsTab from '../components/user-profile/MyNftsTab';
import Svg, { SvgSize } from '../../../../core/presentation/components/Svg';
import Actions, { ActionsLayout } from '../../../../core/presentation/components/Actions';
import Button, { ButtonColor } from '../../../../core/presentation/components/Button';
import EditUserModal from '../components/EditUserModal';

import BorderColorIcon from '@mui/icons-material/BorderColor';
import SvgCudosLogo from '../../../../public/assets/vectors/cudos-logo.svg';
import '../styles/page-user-profile.css';

type Props = {
    bitcoinStore?: BitcoinStore;
    accountSessionStore?: AccountSessionStore;
    userProfilePageStore?: UserProfilePageStore,
    editUserModalStore?: EditUserModalStore;
}

function UserProfilePage({ bitcoinStore, userProfilePageStore, accountSessionStore, editUserModalStore }: Props) {
    useEffect(() => {
        async function init() {
            await bitcoinStore.init();
            await userProfilePageStore.init();
        }
        init();
    }, []);

    const accountEntity = accountSessionStore.accountEntity;
    const userEntity = accountSessionStore.userEntity;

    function onClickProfileImages() {
        editUserModalStore.showSignalWithDefaultCallback(userEntity);
    }

    function onClickEditBtcAddres() {

    }

    return (
        <PageLayoutComponent
            className = { 'PageUserProfile' }
            modals = {
                <>
                    <EditUserModal />
                </>
            } >
            <PageHeader />

            <div className={'PageContent AppContent'} >
                <ProfileHeader coverPictureUrl={userEntity.coverImgUrl} profilePictureUrl={userEntity.profileImgUrl} />
                <Actions layout={ActionsLayout.LAYOUT_ROW_RIGHT}>
                    <Button
                        onClick={onClickProfileImages}
                        color={ButtonColor.SCHEME_4} >
                        <Svg size = { SvgSize.CUSTOM } svg={BorderColorIcon} />
                        Edit Profile images
                    </Button>
                    <Button
                        onClick={onClickEditBtcAddres}
                        color={ButtonColor.SCHEME_4} >
                        <Svg size = { SvgSize.CUSTOM } svg={BorderColorIcon} />
                        Edit BTC Address
                    </Button>
                </Actions>
                <div className={'ProfileHeaderDataRow'}>
                    <div className={'AccountName H2 Bold'}>{accountEntity.name}</div>
                    <div className={'FlexRow'}>
                        <Svg svg = { SvgCudosLogo } />
                        <div className={'CudosWalletAddrees Dots Bold B1 ColorPrimary060'}>{userEntity.cudosWalletAddress}</div>
                        <div className={'JoinDate B3'}>Joined {accountEntity.formatDateJoined()}</div>
                    </div>
                </div>
                <div className = { 'SectionDivider' } />
                <NavRowTabs
                    className = { 'NavRowHolder' }
                    navTabs={[
                        createNavRowTab('My NFTs', userProfilePageStore.isMyNftTab(), userProfilePageStore.markMyNftTab),
                        createNavRowTab('Earnings Info', userProfilePageStore.isMyEarningsTab(), userProfilePageStore.markMyEarningsTab),
                        createNavRowTab('History', userProfilePageStore.isMyHistoryTab(), userProfilePageStore.markMyHistoryTab),
                    ]} />

                <AnimationContainer active = { userProfilePageStore.isMyNftTab() } >
                    {userProfilePageStore.isMyNftTab() === true && (
                        <MyNftsTab />
                    ) }
                </AnimationContainer>

                <AnimationContainer active = { userProfilePageStore.isMyEarningsTab() } >
                    {userProfilePageStore.isMyEarningsTab() === true && (
                        <MyEarningsTab />
                    ) }
                </AnimationContainer>

                <AnimationContainer active = { userProfilePageStore.isMyHistoryTab() } >
                    {userProfilePageStore.isMyHistoryTab() === true && (
                        <MyHistoryTab />
                    ) }
                </AnimationContainer>

            </div>

            <PageFooter />
        </PageLayoutComponent>
    )
}

export default inject((stores) => stores)(observer(UserProfilePage));
