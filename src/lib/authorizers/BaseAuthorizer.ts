import { SignedMessage } from '../../types';

export interface BaseAuthorizer {
    name: string;

    addAuthorizedUser: (address: string, gasTankName: string) => Promise<void>;
    refreshUserAuthorization: (
        address: string,
        gasTankName: string
    ) => Promise<string>;
    isUserAuthorized: (
        signedNonce: SignedMessage,
        address: string,
        nonce: string,
        gasTankName: string
    ) => Promise<boolean>;
    deleteUser: (address: string) => Promise<void>;
}
