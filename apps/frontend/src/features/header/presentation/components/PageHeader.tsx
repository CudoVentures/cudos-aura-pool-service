import Svg from '../../../../core/presentation/components/Svg';
import SvgAuraPoolLogo from '../../../../public/assets/vectors/aura-pool-logo.svg';
import { useLocation, useNavigate } from 'react-router-dom';

import React from 'react'
import '../styles/page-header.css'
import AppRoutes from '../../../app-routes/entities/AppRoutes';
import WalletStore from '../../../ledger/presentation/stores/WalletStore';
import S from '../../../../../src/core/utilities/Main';
import Actions, { ACTIONS_HEIGHT } from '../../../../core/presentation/components/Actions';
import Button from '../../../../core/presentation/components/Button';
import { inject, observer } from 'mobx-react';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface Props {
    walletStore?: WalletStore
}

function PageHeader({ walletStore }: Props) {
    const navigate = useNavigate();
    const location = useLocation();

    function isLocationMarketplace(): boolean {
        return location.pathname !== AppRoutes.REWARDS_CALCULATOR && location.pathname !== AppRoutes.USER_PROFILE
    }

    function onClickAddress() {
        navigate(`${AppRoutes.USER_PROFILE}/${walletStore.getAddress()}`)
    }

    function onClickAddressMenu(event) {
        event.stopPropagation();
    }

    function onClickLogo() {
        navigate(AppRoutes.MARKETPLACE);
    }

    return (
        <footer className={'PageHeader FlexRow FlexSplit'}>
            <Svg className={'SVG IconLogoWithText Clickable'} svg={ SvgAuraPoolLogo } onClick = { onClickLogo } />
            <div className={'StartRightBlock FlexRow'}>
                <div className={`B1 SemiBold Clickable ${S.CSS.getActiveClassName(isLocationMarketplace())}`} onClick={() => navigate(AppRoutes.MARKETPLACE)}>Marketplace</div>
                <div className={`B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.REWARDS_CALCULATOR)}`} onClick={() => navigate(AppRoutes.REWARDS_CALCULATOR)}>Rewards Calculator</div>

                {walletStore.isConnected()
                    ? <>
                        <div className={`B1 SemiBold Clickable ${S.CSS.getActiveClassName(location.pathname === AppRoutes.USER_PROFILE)}`} onClick={onClickAddress}>Profile</div>
                        <div className={'VerticalSeparator'} />
                        <div className={'FlexRow BalanceRow B2'}>
                            <Svg svg={AccountBalanceWalletIcon} />
                            <div className={'SemiBold Gray'}>Balance:</div>
                            <div className={'Bold'}>{walletStore.getBalance()} CUDOS</div>
                        </div>
                        <div className={'FlexRow AddressRow'}>
                            <div className={'Bold'}>{walletStore.getAddress()}</div>
                            <Svg className={'Clickable'} onClick={onClickAddressMenu} svg={MoreVertIcon} />
                        </div>
                    </>
                    : <>
                        <Actions height={ACTIONS_HEIGHT.HEIGHT_48}>
                            <Button onClick={() => walletStore.connectKeplr()}>Connect Wallet</Button>
                        </Actions>
                    </>
                }
            </div>
        </footer>
    )
}

export default inject((stores) => stores)(observer(PageHeader));
