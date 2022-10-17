import MiningFarmEntity from '../../entities/MiningFarmEntity';

export default interface MiningFarmRepo {

    fetchAllMiningFarms(): Promise < MiningFarmEntity[] >;
    fetchMiningFarmsByIds(farmids: string[]): Promise < MiningFarmEntity[] >;
}
