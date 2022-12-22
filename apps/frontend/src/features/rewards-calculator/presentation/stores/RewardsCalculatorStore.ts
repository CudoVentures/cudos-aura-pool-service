import { computed, makeAutoObservable, runInAction } from 'mobx';

import MiningFarmEntity from '../../../mining-farm/entities/MiningFarmEntity';

import MiningFarmRepo from '../../../mining-farm/presentation/repos/MiningFarmRepo';
import BitcoinStore from '../../../bitcoin-data/presentation/stores/BitcoinStore';
import BigNumber from 'bignumber.js';
import ProjectUtils from '../../../../core/utilities/ProjectUtils';
import BitcoinBlockchainInfoEntity from '../../../bitcoin-data/entities/BitcoinBlockchainInfoEntity';

export default class RewardsCalculatorStore {

    bitcoinStore: BitcoinStore;
    miningFarmRepo: MiningFarmRepo;

    miningFarmsEntities: MiningFarmEntity[];

    selectedMiningFarmEntity: MiningFarmEntity;
    networkDifficultyEdit: BigNumber;
    hashPowerInThInputValue: string;

    constructor(bitcoinStore: BitcoinStore, miningFarmRepo: MiningFarmRepo) {
        this.bitcoinStore = bitcoinStore;
        this.miningFarmRepo = miningFarmRepo;

        this.miningFarmsEntities = [];

        this.resetDefaults();

        makeAutoObservable(this);
    }

    resetDefaults() {
        runInAction(() => {
            this.selectedMiningFarmEntity = null;
            this.networkDifficultyEdit = null;
            this.hashPowerInThInputValue = '0';
        })
    }

    isDefault() {
        if (this.selectedMiningFarmEntity !== null) {
            return false;
        }

        if (this.networkDifficultyEdit !== null) {
            return false;
        }

        if (this.hashPowerInThInputValue !== '0') {
            return false;
        }

        return true;
    }

    async init() {
        await this.bitcoinStore.init();
        const miningFarmsEntities = await this.miningFarmRepo.fetchAllMiningFarms();
        runInAction(() => {
            this.miningFarmsEntities = miningFarmsEntities
        })
    }

    hasSelectedMiningFarm(): boolean {
        return this.selectedMiningFarmEntity !== null;
    }

    getNetworkDifficultyInputValue(): string {
        return this.networkDifficultyEdit !== null ? this.networkDifficultyEdit.toString() : this.bitcoinStore.getNetworkDifficulty();
    }

    getHashPowerInTh(): number {
        return parseFloat(this.hashPowerInThInputValue);
    }

    onChangeMiningFarm = (selectedMiningFarmId: string) => {
        runInAction(() => {
            this.selectedMiningFarmEntity = this.miningFarmsEntities.find((entity) => {
                return entity.id === selectedMiningFarmId;
            });

            this.hashPowerInThInputValue = this.selectedMiningFarmEntity.hashPowerInTh.toString();
        });
    }

    onChangeHashPowerInInput = (value: string) => {
        runInAction(() => {

            if (value === '') {
                this.hashPowerInThInputValue = '0';
                return;
            }

            const floatValue = parseFloat(value);
            if (floatValue < 0) {
                value = '0';
            }
            if (floatValue > this.selectedMiningFarmEntity.hashPowerInTh) {
                value = this.selectedMiningFarmEntity.hashPowerInTh.toString();
            }

            while (value[0] === '0') {
                value = value.substring(1);
            }

            this.hashPowerInThInputValue = value;
        });
    }

    onChangeHashPowerInThSlider = (event: MouseEvent, value: number) => {
        runInAction(() => {
            this.hashPowerInThInputValue = value.toString();
        });
    }

    onChangeNetworkDifficulty = (input: string) => {
        runInAction(() => {
            this.networkDifficultyEdit = new BigNumber(input !== '' ? input : 1);
        });
    }

    getMaintenanceFeePerThInBtc(): BigNumber {
        if (this.selectedMiningFarmEntity === null) {
            return new BigNumber(0);
        }

        return this.selectedMiningFarmEntity.getMaintenanceFeePerThInBtc();
    }

    getHashPowerInThInputValue(): number {
        return this.hashPowerInThInputValue
    }

    formatCost(): string {
        if (this.selectedMiningFarmEntity === null) {
            return '-';
        }

        return `${this.selectedMiningFarmEntity.formatMaintenanceFeesInBtc()}`;
    }

    calculateGrossRewardPerMonth(): BigNumber {
        let bitcoinHashPower = null;
        if (this.networkDifficultyEdit !== null) {
            bitcoinHashPower = BitcoinBlockchainInfoEntity.getNetworkHashPowerInTh(this.networkDifficultyEdit);
        }

        return this.bitcoinStore.calculateRewardsPerMonth(this.getHashPowerInTh(), bitcoinHashPower);
    }

    @computed
    calculateNetRewardPetMonth(): BigNumber {
        if (this.selectedMiningFarmEntity === null) {
            return new BigNumber(0);
        }

        const k = this.getHashPowerInTh() / this.selectedMiningFarmEntity.hashPowerInTh;
        const maintenanceFeeInBtc = new BigNumber(k).multipliedBy(this.selectedMiningFarmEntity.maintenanceFeeInBtc);
        const incomeAfterCudosFeeInBtc = this.calculateGrossRewardPerMonth().multipliedBy(ProjectUtils.REMAINDER_AFTER_CUDOS_FEE);
        const incomeAfterMaitenanceFeeInBtc = incomeAfterCudosFeeInBtc.minus(maintenanceFeeInBtc);

        return incomeAfterMaitenanceFeeInBtc;
    }

    formatNetRewardPerMonth(): string {
        return `${this.calculateNetRewardPetMonth().toFixed(5)} BTC`;
    }
}
