import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import AlertStore from '../../../../core/presentation/stores/AlertStore';
import ModalStore from '../../../../core/presentation/stores/ModalStore';
import WalletStore from '../../../ledger/presentation/stores/WalletStore';
import UserEntity from '../../entities/UserEntity';
import AccountRepo from '../repos/AccountRepo';

export default class EditUserBtcModalStore extends ModalStore {

    accountRepo: AccountRepo;
    alertStore: AlertStore;
    walletStore: WalletStore;

    @observable userEntity: UserEntity;
    @observable bitcoinPayoutWalletAddress: string;
    @observable onFinish: () => void;

    constructor(accountRepo: AccountRepo, alertStore: AlertStore, walletStore: WalletStore) {
        super();

        this.accountRepo = accountRepo;
        this.alertStore = alertStore;
        this.walletStore = walletStore;

        this.userEntity = null;
        this.bitcoinPayoutWalletAddress = '';

        makeObservable(this);
    }

    @action
    showSignal(userEntity: UserEntity, onFinish: () => void) {
        this.userEntity = userEntity;
        this.bitcoinPayoutWalletAddress = userEntity.bitcoinPayoutWalletAddress;
        this.onFinish = onFinish;

        this.show();
    }

    @action
    showSignalWithDefaultCallback(userEntity: UserEntity) {
        const clonedUserEntity = userEntity.clone();
        this.showSignal(clonedUserEntity, () => {
            runInAction(() => {
                userEntity.copy(clonedUserEntity);
            });
        });
    }

    onChangeBitcoinPayoutWalletAddress = (value: string) => {
        runInAction(() => {
            this.bitcoinPayoutWalletAddress = value;
        });
    }

    isBtcAddressChanged(): boolean {
        return this.bitcoinPayoutWalletAddress !== this.userEntity.bitcoinPayoutWalletAddress;
    }

    hide = () => {
        runInAction(() => {
            this.userEntity = null;
            this.bitcoinPayoutWalletAddress = '';
            super.hide();
        });
    }

    async confirmBitcoinAddress(): Promise < void > {
        if (this.walletStore.isConnected() === false) {
            this.alertStore.show('Please connect a wallet');
            throw new Error('Please connect a wallet');
        }

        const client = await this.walletStore.getClient();
        const walletAddress = this.walletStore.getAddress();

        const balance = await this.accountRepo.fetchAddressCudosBalance(walletAddress);
        if (balance === '0') {
            this.alertStore.show('Not enough funds');
            throw new Error('Not enough funds');
        }

        try {
            await this.accountRepo.confirmBitcoinAddress(client, walletAddress, this.bitcoinPayoutWalletAddress);
        } catch (ex) {
            this.alertStore.show('Unable to update BTC payout address');
            throw Error('Unable to confirm bitcoin address');
        }
    }

    async editSessionUser() {
        this.userEntity.bitcoinPayoutWalletAddress = this.bitcoinPayoutWalletAddress;
        await this.accountRepo.editSessionUser(this.userEntity);
    }
}
