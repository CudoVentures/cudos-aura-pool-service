import React, { useEffect, useState } from 'react';
import { inject, observer } from 'mobx-react';

import PageLayoutComponent from '../../../../core/presentation/components/PageLayoutComponent';
import PageFooter from '../../../footer/presentation/components/PageFooter';
import PageAdminHeader from '../../../header/presentation/components/PageAdminHeader';

import AccountSessionStore from '../stores/AccountSessionStore';
import AppStore from '../../../../core/presentation/stores/AppStore';
import S from '../../../../core/utilities/Main';
import Input from '../../../../core/presentation/components/Input';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import Actions from '../../../../core/presentation/components/Actions';
import Button from '../../../../core/presentation/components/Button';
import Svg from '../../../../core/presentation/components/Svg';
import '../styles/credit-account-settings.css';

type Props = {
    accountSessionStore?: AccountSessionStore;
    appStore?: AppStore;
}

function CreditAccountSettings({ accountSessionStore }: Props) {

    const [tempAccountEntity] = useState(accountSessionStore.accountEntity.deepClone() || null);
    const [tempAdminEntity] = useState(accountSessionStore.adminEntity.clone() || null);
    const [emailInputDisabled, setEmailInputDisabled] = useState(true);
    const [ownerInputDisabled, setOwnerInputDisabled] = useState(true);
    const [walletInputDisabled, setWalletInputDisabled] = useState(true);

    function isFieldChanged(): boolean {
        return accountSessionStore.accountEntity.email !== tempAccountEntity.email
        || accountSessionStore.accountEntity.name !== tempAccountEntity.name
        || accountSessionStore.adminEntity.cudosWalletAddress !== tempAdminEntity.cudosWalletAddress
    }

    return (
        <PageLayoutComponent className = { 'CreditAccountSettings' }>

            <PageAdminHeader />

            {accountSessionStore.accountEntity !== null && accountSessionStore.adminEntity !== null
            && (<div className = { 'PageContent AppContent FlexColumn' } >
                <div className={'EditForm FlexColumn'}>
                    <div className={'Header FlexRow'}>
                        <div className={'H2 Bold'}>Account Details</div>
                        {isFieldChanged() === true
                     && (<Actions>
                         <Button
                             onClick={() => accountSessionStore.creditAdminSettings(adminEntity, tempAccountEntity)}
                         >Save Changes</Button>
                     </Actions>)}
                    </div>
                    <div className={'HorizontalSeparator'}/>
                    <div className={'InputRow FlexRow'}>
                        <div className={'InputLabel'}>Account Email</div>
                        <div className={'InputWithButton FlexRow'}>
                            <Input
                                disabled={emailInputDisabled}
                                value={tempAccountEntity.email}
                                onChange={(value: string) => { tempAccountEntity.email = value }}
                            />
                            <Actions>
                                <Button onClick={() => setEmailInputDisabled(!emailInputDisabled)}>
                                    <Svg svg={BorderColorIcon} />
                                Change
                                </Button>
                            </Actions>
                        </div>
                    </div>
                    <div className={'InputRow FlexRow'}>
                        <div className={'InputLabel'}>Account Оwner</div>
                        <div className={'InputWithButton FlexRow'}>
                            <Input
                                disabled={ownerInputDisabled}
                                value={tempAccountEntity.name}
                                onChange={(value: string) => { tempAccountEntity.name = value }}
                            />
                            <Actions>
                                <Button onClick={() => setOwnerInputDisabled(!ownerInputDisabled)}>
                                    <Svg svg={BorderColorIcon} />
                                Change
                                </Button>
                            </Actions>
                        </div>
                    </div>
                    <div className={'InputRow FlexRow'}>
                        <div className={'InputLabel'}>Connected Wallet</div>
                        <div className={'InputWithButton FlexRow'}>
                            <Input
                                disabled={walletInputDisabled}
                                value={tempAdminEntity.cudosWalletAddress}
                                onChange={(value: string) => { tempAdminEntity.cudosWalletAddress = value }}
                            />
                            <Actions>
                                <Button onClick={() => setWalletInputDisabled(!walletInputDisabled)}>
                                    <Svg svg={BorderColorIcon} />
                                Change
                                </Button>
                            </Actions>
                        </div>
                    </div>
                </div>
            </div>)}

            <PageFooter />

        </PageLayoutComponent>
    )

}

export default inject((stores) => stores)(observer(CreditAccountSettings));
