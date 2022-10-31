import React from 'react';
import { inject, observer } from 'mobx-react';

import ExtendedChart, { createHeaderValueTab } from '../../../../../core/presentation/components/ExtendedChart';
import StyledContainer, { ContainerPadding } from '../../../../../core/presentation/components/StyledContainer';

import UserProfilePageStore from '../../stores/UserProfilePageStore';

import '../../styles/my-earnings-tab.css';

type Props = {
    userProfilePageStore?: UserProfilePageStore,
}

function MyEarningsTab({ userProfilePageStore }: Props) {
    return (
        <div className={'MyEarningsTab FlexColumn'}>
            <StyledContainer containerPadding = { ContainerPadding.PADDING_24 }>
                <ExtendedChart
                    headerValueTabs={[
                        createHeaderValueTab('Total BTC Earnings', '$3.45k'),
                        createHeaderValueTab('Total NFTs Bought', '34'),
                    ]}
                    extendedChartState={userProfilePageStore.extendedChartState} />
            </StyledContainer>
            <div className={'Grid GridColumns3 BalancesDataContainer'}>
                <StyledContainer className={'FlexColumn BalanceColumn'} containerPadding={ContainerPadding.PADDING_24}>
                    <div className={'B1 SemiBold'}>Wallet Balance</div>
                    <div className={'FlexColumn ValueColumn'}>
                        <div>
                            <span className={'H2 Bold'}>456,789<span className={'SecondaryColor'}>.123456</span></span>
                            <span className={'H3 SecondaryColor'}> CUDOS</span>
                        </div>
                        <div className={'SecondaryColor H3 Bold'}>$345,678.00</div>
                    </div>
                </StyledContainer>
                <StyledContainer className={'FlexColumn BalanceColumn'} containerPadding={ContainerPadding.PADDING_24}>
                    <div className={'B1 SemiBold'}>BTC Earned</div>
                    <div className={'FlexColumn ValueColumn'}>
                        <div>
                            <span className={'H2 Bold'}>0.232</span>
                            <span className={'H3 SecondaryColor'}> BTC</span>
                        </div>
                        <div className={'SecondaryColor H3 Bold'}>$4,678.00 USD</div>
                    </div>
                </StyledContainer>
                <StyledContainer className={'FlexColumn BalanceColumn'} containerPadding={ContainerPadding.PADDING_24}>
                    <div className={'B1 SemiBold'}>Total Contract Hash Power</div>
                    <div className={'FlexColumn ValueColumn'}>
                        <div>
                            <span className={'H2 Bold'}>100.563</span>
                            <span className={'H3 SecondaryColor'}> TH/S</span>
                        </div>
                        <div className={'SecondaryColor H3 Bold'}>$345,678.00</div>
                    </div>
                </StyledContainer>
            </div>
        </div>
    )
}

export default inject((stores) => stores)(observer(MyEarningsTab));
