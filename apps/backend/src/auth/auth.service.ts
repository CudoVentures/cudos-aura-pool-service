import {
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verifyNonceMsgSigner } from 'cudosjs/build/utils/nonce';
import app from '../../../chain-observer/src/app';
import AccountService from '../account/account.service';
import AccountEntity from '../account/entities/account.entity';
import AdminEntity from '../account/entities/admin.entity';
import UserEntity from '../account/entities/user.entity';
import { IntBoolValue } from '../common/utils';
import { SIGN_NONCE } from './constants';
import JwtToken from './jwtToken.entity';

@Injectable()
export class AuthService {
    constructor(
    private accountService: AccountService,
    private jwtService: JwtService,
    private configService: ConfigService,
    ) {}

    // async validateUser(email: string, password: string): Promise < AccountEntity > {
    //     const accountEntity = await this.accountService.findAccountByEmail(email);
    //     if (accountEntity === null) {
    //         throw new NotFoundException('Incorrect email');
    //     }

    //     if (AccountService.isPassValid(accountEntity, password) === false) {
    //         throw new UnauthorizedException('Incorrect password');
    //     }

    //     return accountEntity;
    // }

    // async login(accountEntity: AccountEntity) {
    //     const jwtToken = JwtToken.newInstance(accountEntity);
    //     const accessToken = this.jwtService.sign(JwtToken.toJson(jwtToken));
    //     return { accessToken }
    // }

    async register(email: string, pass: string, cudosWalletAddress: string, name: string, signedTx: any): Promise < void > {
        let accountEntity = await this.accountService.findAccountByEmail(email);
        let adminEntity = null;
        if (accountEntity !== null) {
            throw new NotFoundException('Email is already in use');
        }

        accountEntity = AccountEntity.newInstanceAdmin();
        accountEntity.email = email;
        accountEntity.name = name;
        accountEntity.salt = AccountService.generateSalt();
        accountEntity.hashedPass = AccountService.generateHashedPass(pass, accountEntity.salt);
        accountEntity = await this.accountService.creditAccount(accountEntity);

        adminEntity = AdminEntity.newInstanceForAccount(accountEntity.accountId);
        adminEntity.cudosWalletAddress = cudosWalletAddress;

        adminEntity = await this.accountService.creditAdmin(adminEntity);
    }

    async login(email: string, pass: string, cudosWalletAddress: string, walletName: string, pubKeyType: string, pubKeyValue: string, signature: string, sequence: number, accountNumber: number): Promise < string > {
        if (email !== '' || pass !== '') {
            return this.loginUsingCredentials(email, pass);
        }

        return this.loginUsingWallet(cudosWalletAddress, walletName, pubKeyType, pubKeyValue, signature, sequence, accountNumber);
    }

    private async loginUsingCredentials(email: string, pass: string): Promise < string > {
        const accountEntity = await this.accountService.findAccountByEmail(email);
        if (accountEntity === null) {
            throw new NotFoundException('Incorrect email');
        }

        if (AccountService.isPassValid(accountEntity, pass) === false) {
            throw new UnauthorizedException('Incorrect password');
        }

        const jwtToken = JwtToken.newInstance(accountEntity);
        return this.jwtService.sign(JwtToken.toJson(jwtToken));
    }

    private async loginUsingWallet(cudosWalletAddress: string, walletName: string, pubKeyType: any, pubKeyValue: any, signature: string, sequence: number, accountNumber: number): Promise < string > {
        let accountEntity = null;
        let userEntity = await this.accountService.findUserByCudosWalletAddress(cudosWalletAddress);
        const chainId = this.configService.get(`APP_${this.configService.get('APP_DEFAULT_NETWORK')}_CHAIN_ID`);

        const signedTx = {
            pub_key: {
                type: pubKeyType,
                value: pubKeyValue,
            },
            signature,
        }

        const isSigner = await verifyNonceMsgSigner(signedTx, cudosWalletAddress, SIGN_NONCE, sequence, accountNumber, chainId);

        if (!isSigner) {
            throw new Error('Message not signed by user address.');
        }

        if (userEntity === null) { // register new wallet
            accountEntity = new AccountEntity();
            userEntity = new UserEntity();

            accountEntity.name = walletName;
            accountEntity.emailVerified = IntBoolValue.TRUE;

            userEntity.cudosWalletAddress = cudosWalletAddress;

            accountEntity = await this.accountService.creditAccount(accountEntity);
            userEntity.accountId = accountEntity.accountId;

            userEntity = await this.accountService.creditUser(userEntity);
        } else {
            accountEntity = await this.accountService.findAccountById(userEntity.accountId);
        }

        const jwtToken = JwtToken.newInstance(accountEntity);
        return this.jwtService.sign(JwtToken.toJson(jwtToken));
    }

}
