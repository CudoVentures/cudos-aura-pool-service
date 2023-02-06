import { runInActionAsync } from '../../../core/utilities/ProjectUtils';
import KycEntity from '../../entities/KycEntity';
import KycRepo from '../../presentation/repos/KycRepo';
import KycApi from '../data-sources/KycApi';

export default class KycApiRepo implements KycRepo {

    kycApi: KycApi;
    enableActions: () => void;
    disableActions: () => void;
    showAlert: (msg: string, positiveListener?: null | (() => boolean | void), negativeListener?: null | (() => boolean | void)) => void;

    constructor() {
        this.kycApi = new KycApi();
        this.enableActions = null;
        this.disableActions = null;
        this.showAlert = null;
    }

    setPresentationActionsCallbacks(enableActions: () => void, disableActions: () => void) {
        this.enableActions = enableActions;
        this.disableActions = disableActions;
    }

    setPresentationAlertCallbacks(showAlert: (msg: string, positiveListener: null | (() => boolean | void), negativeListener: null | (() => boolean | void)) => void) {
        this.showAlert = showAlert;
    }

    async fetchKyc(): Promise < KycEntity > {
        try {
            this.disableActions?.();
            return await this.kycApi.fetchKyc();
        } finally {
            this.enableActions?.();
        }
    }

    async creditKyc(kycEntity: KycEntity): Promise < string > {
        try {
            this.disableActions?.();
            const creditKycResult = await this.kycApi.creditKyc(kycEntity);

            await runInActionAsync(() => {
                Object.assign(kycEntity, creditKycResult.kycEntity);
            });
            return creditKycResult.token;
        } finally {
            this.enableActions?.();
        }
    }

    async createCheck(kycEntity: KycEntity): Promise < void > {
        try {
            this.disableActions?.();
            const resultKycEntity = await this.kycApi.createCheck();

            await runInActionAsync(() => {
                console.log('new kyc', resultKycEntity, resultKycEntity.getKycStatus());
                Object.assign(kycEntity, resultKycEntity);
            });
        } finally {
            this.enableActions?.();
        }
    }

}
