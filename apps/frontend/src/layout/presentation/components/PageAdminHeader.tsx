import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom';
import { inject, observer } from 'mobx-react';

import S from '../../../core/utilities/Main';
import AppRoutes from '../../../app-routes/entities/AppRoutes';
import AccountSessionStore from '../../../accounts/presentation/stores/AccountSessionStore';
import WalletStore from '../../../ledger/presentation/stores/WalletStore';
import PresaleStore from '../../../app-routes/presentation/PresaleStore';

import Svg from '../../../core/presentation/components/Svg';
import HeaderWallet from './HeaderWallet';
import Actions from '../../../core/presentation/components/Actions';
import Button from '../../../core/presentation/components/Button';

import SvgCudosMarketsLogo from '../../../public/assets/vectors/cudos-markets-logo.svg';
import '../styles/page-admin-header.css'
import { REWARDS_CALCULATOR } from '../../../core/utilities/Links';
import { PRESALE_CONSTS } from '../../../core/utilities/Constants';

type Props = {
    accountSessionStore?: AccountSessionStore;
    walletStore?: WalletStore,
    presaleStore?: PresaleStore,
};

function PageAdminHeader({ accountSessionStore, walletStore, presaleStore }: Props) {

    const navigate = useNavigate();
    const location = useLocation();

    function onClickLogo() {
        navigate(AppRoutes.HOME);
    }

    function onClickMarketplace() {
        navigate(AppRoutes.MARKETPLACE);
    }

    // function onClickRewardsCalculator() {
    //     navigate(AppRoutes.REWARDS_CALCULATOR);
    // }

    function onClickAnalytics() {
        navigate(AppRoutes.FARM_ANALYTICS);
    }

    function onClickCreditMiningFarm() {
        navigate(AppRoutes.HOME);
    }

    async function onClickLogout() {
        await accountSessionStore.logout();
        navigate(AppRoutes.HOME);
    }

    return (
        <header className={'PageAdminHeader FlexRow'}>
            <div className={'LogoHeader FlexRow'}>
                <Svg className={'SVG IconLogoWithText Clickable'} svg={ SvgCudosMarketsLogo } onClick = { onClickLogo } />
                <div className={'AdminPortalNav B2 SemiBold'}>Farm Portal</div>
            </div>

            <div className={'NavCnt FlexRow'}>
                { presaleStore.isInPresale() === true ? (
                    <div className={`NavButton B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.MARKETPLACE)}`} onClick={onClickMarketplace}>{ PRESALE_CONSTS.RESPECT_ALLOWLIST ? 'Presale' : 'Public sale' }</div>
                ) : (
                    <div className={`NavButton B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.MARKETPLACE)}`} onClick={onClickMarketplace}> Marketplace </div>
                ) }
                {/* <div className={`NavButton B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.REWARDS_CALCULATOR)}`} onClick={onClickRewardsCalculator}>Rewards Calculator</div> */}
                <a className={'NavButton B1 SemiBold Clickable'} href={REWARDS_CALCULATOR} target='_blank' rel="noreferrer">Rewards Calculator</a>

                { accountSessionStore.isAdmin() === true && (
                    <>
                        <div className={`NavButton B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.CREDIT_MINING_FARM)}`} onClick={onClickCreditMiningFarm}>Farm Profile</div>
                        { accountSessionStore.hasApprovedMiningFarm() === true && (
                            <div className={`NavButton B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.FARM_ANALYTICS)}`} onClick={onClickAnalytics}>Analytics</div>
                        ) }
                        <HeaderWallet />
                    </>
                ) }

                { accountSessionStore.isLoggedIn() === true && walletStore.isConnected() === false && (
                    <Actions>
                        <Button onClick={onClickLogout}>Logout</Button>
                    </Actions>
                ) }
            </div>
        </header>
    )
}

export default inject((stores) => stores)(observer(PageAdminHeader));
