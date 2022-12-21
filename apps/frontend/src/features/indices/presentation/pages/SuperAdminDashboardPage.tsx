import React, { useEffect } from 'react';
import { inject, observer } from 'mobx-react';
import { useNavigate } from 'react-router-dom';
import numeral from 'numeral';

import ViewCollectionModal from '../../../collection/presentation/components/ViewCollectionModal';
import ViewMiningFarmModal from '../../../mining-farm/presentation/components/ViewMiningFarmModal';
import ChangePasswordModal from '../../../accounts/presentation/components/ChangePasswordModal';
import SuperAdminDashboardPageStore from '../stores/SuperAdminDashboardPageStore';
import ProjectUtils from '../../../../core/utilities/ProjectUtils';
import AppRoutes from '../../../app-routes/entities/AppRoutes';
import CudosStore from '../../../cudos-data/presentation/stores/CudosStore';

import PageLayoutComponent from '../../../../core/presentation/components/PageLayoutComponent';
import PageFooter from '../../../footer/presentation/components/PageFooter';
import PageSuperAdminHeader from '../../../header/presentation/components/PageSuperAdminHeader';
import ColumnLayout from '../../../../core/presentation/components/ColumnLayout';
import QueuedCollections from '../../../collection/presentation/components/QueuedCollections';
import QueuedMiningFarms from '../../../mining-farm/presentation/components/QueuedMiningFarms';
import StyledLayout from '../../../../core/presentation/components/StyledLayout';
import Button, { ButtonPadding } from '../../../../core/presentation/components/Button';
import LoadingIndicator from '../../../../core/presentation/components/LoadingIndicator';
import Table, { createTableCell, createTableRow } from '../../../../core/presentation/components/Table';
import { ALIGN_CENTER, ALIGN_LEFT } from '../../../../core/presentation/components/TableDesktop';
import DefaultIntervalPicker from '../../../analytics/presentation/components/DefaultIntervalPicker';
import RowLayout from '../../../../core/presentation/components/RowLayout';
import StyledContainer, { ContainerPadding } from '../../../../core/presentation/components/StyledContainer';
import MegaWalletBalance from '../../../accounts/presentation/components/MegaWalletBalance';
import ChartHeading from '../../../analytics/presentation/components/ChartHeading';
import DailyChart from '../../../analytics/presentation/components/DailyChart';
import ChartInfo from '../../../analytics/presentation/components/ChartInfo';

import '../styles/page-super-admin-dashboard.css';

type Props = {
    superAdminDashboardPageStore?: SuperAdminDashboardPageStore
    cudosStore?: CudosStore;
}

function SuperAdminDashboardPage({ superAdminDashboardPageStore, cudosStore }: Props) {
    const bestPerformingMiningFarms = superAdminDashboardPageStore.bestPerformingMiningFarms;
    const { totalEarningsEntity, earningsDefaultIntervalPickerState, farmsDefaultIntervalPickerState } = superAdminDashboardPageStore;

    const navigate = useNavigate();

    useEffect(() => {
        cudosStore.init();
        superAdminDashboardPageStore.init();
    }, []);

    function onClickAnalytics() {
        navigate(AppRoutes.SUPER_ADMIN_ANALYTICS);
    }

    function onClickAllFarms() {
        navigate(AppRoutes.SUPER_ADMIN_MINING_FARMS);
    }

    function onClickTopFarmRow(i: number) {
        const miningFarmEntity = bestPerformingMiningFarms[i];
        navigate(`${AppRoutes.CREDIT_MINING_FARM}/${miningFarmEntity.id}`);
    }

    function renderTopPerformingFarmRows() {
        return bestPerformingMiningFarms.map((miningFarmEntity) => {
            const miningFarmPerformanceEntity = superAdminDashboardPageStore.getMiningFarmPerformanceEntity(miningFarmEntity.id);
            return createTableRow([
                createTableCell((
                    <div className = { 'FlexRow Bold' } >
                        <div className = { 'TopPerformingMiningFarmImg ImgCoverNode' } style = { ProjectUtils.makeBgImgStyle(miningFarmEntity.coverImgUrl) } />
                        { miningFarmEntity.name }
                    </div>
                )),
                createTableCell((
                    <div className = { 'Bold' } >
                        <div className={'B2 Bold TopPerformingMiningFarmsCellTitle'}>{CudosStore.formatAcudosInCudos(miningFarmPerformanceEntity.volumePer24HoursInAcudos)}</div>
                        <div className={'B3 FlexRow FarmVolumePriceRow'}>
                            <div className={'SemiBold ColorNeutral060'}>{numeral(miningFarmPerformanceEntity.volumePer24HoursInUsd).format(ProjectUtils.NUMERAL_USD)}</div>
                            {/* <div className={'ColorSuccess060'}>+39.1%</div> */}
                        </div>
                    </div>
                )),
                createTableCell((
                    <div className = { 'Bold' } >
                        <div className={'B2 Bold TopPerformingMiningFarmsCellTitle'}>{CudosStore.formatAcudosInCudos(miningFarmPerformanceEntity.floorPriceInAcudos)}</div>
                        <div className={'B3 SemiBold Gray ColorNeutral060'}>{cudosStore.formatConvertedAcudosInUsd(miningFarmPerformanceEntity.floorPriceInAcudos)}</div>
                    </div>
                )),
            ]);
        });
    }

    return (
        <PageLayoutComponent
            className = { 'PageSuperAdminDashboard' }
            modals = { (
                <>
                    <ChangePasswordModal />
                    <ViewCollectionModal />
                    <ViewMiningFarmModal />
                </>
            ) }>

            <PageSuperAdminHeader />
            <ColumnLayout className = { 'PageContent PageContentDefaultPadding AppContent' } >
                <div className={'H2 ExtraBold'}>Dashboard</div>
                <RowLayout numColumns = { 2 }>
                    <ColumnLayout>
                        <StyledLayout
                            bottomRightButtons = {
                                <Button padding = { ButtonPadding.PADDING_48 } onClick = { onClickAnalytics }>See All Analytics</Button>
                            } >
                            { totalEarningsEntity === null ? (
                                <LoadingIndicator />
                            ) : (
                                <>
                                    <ChartHeading
                                        leftContent = { (
                                            <>
                                                <ChartInfo label = { 'Total Platform Sales'} value = { cudosStore.formatConvertedAcudosInUsd(totalEarningsEntity.totalSalesInAcudos)} />
                                            </>
                                        ) }
                                        rightContent = { (
                                            <DefaultIntervalPicker defaultIntervalPickerState = { earningsDefaultIntervalPickerState } />
                                        ) } />
                                    <DailyChart
                                        timestampFrom = { earningsDefaultIntervalPickerState.earningsTimestampFrom }
                                        timestampTo = { earningsDefaultIntervalPickerState.earningsTimestampTo }
                                        data = { totalEarningsEntity.earningsPerDayInUsd } />
                                </>
                            ) }
                        </StyledLayout>
                        <StyledContainer className = { 'MegaWalletCnt' } containerPadding = { ContainerPadding.PADDING_24 }>
                            <div className = { 'MegaWalletBalanceTitle B1 SemiBold ColorNeutral070' } >MegaWallet Balance</div>
                            <MegaWalletBalance />
                        </StyledContainer>
                    </ColumnLayout>
                    <StyledLayout
                        className = { 'BestPerformingFarms' }
                        title = { 'Top 5 Best Permorfming Farms' }
                        hasBottomDivider = { true }
                        headerRight = {
                            <DefaultIntervalPicker defaultIntervalPickerState = { farmsDefaultIntervalPickerState } />
                        }
                        bottomRightButtons = {
                            <Button padding = { ButtonPadding.PADDING_48 } onClick = { onClickAllFarms }>See all farms</Button>
                        } >
                        { bestPerformingMiningFarms === null ? (
                            <LoadingIndicator />
                        ) : (
                            <Table
                                className = { 'TopPerformingMiningFarmsTable' }
                                legend={['Farm', '24h Volume', 'Floor Price']}
                                widths={['40%', '30%', '30%']}
                                aligns={[ALIGN_LEFT, ALIGN_CENTER, ALIGN_LEFT]}
                                tableState={superAdminDashboardPageStore.topFarmsTableState}
                                onClickRow = { onClickTopFarmRow }
                                showPaging = { false }
                                rows={renderTopPerformingFarmRows()} />
                        ) }
                    </StyledLayout>
                </RowLayout>
                <QueuedMiningFarms dashboardMode = { true } />
                <QueuedCollections dashboardMode = { true } />
            </ColumnLayout>
            <PageFooter />
        </PageLayoutComponent>
    )

}

export default inject((stores) => stores)(observer(SuperAdminDashboardPage));
