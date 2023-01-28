import { Pool } from 'pg';

import { SupportedChainId } from '../constants/chains';
import { updateGasTankQuery } from '../constants/database';
import {
    BuildExecTransactionType,
    BuildTransactionParams,
    deployProxyWalletParams,
    GasTankProps,
    SendGaslessTransactionParams,
    SendGaslessTransactionType
} from '../types';

import QuestbookAuthorizer from './authorizers/QuestbookAuthorizer';
import { BiconomyRelayer } from './relayers/BiconomyRelayer';

export class GasTank {
    // public fields
    chainId: SupportedChainId;
    createdAt: string;
    fundingKey: number;
    readyPromise: Promise<void>;
    providerURL: string;
    loadRelayer: boolean;
    gasTankId: string;

    // private fields
    #pool: Pool;
    #relayer: BiconomyRelayer; // We can simply swap out biconomy by using a different relayer
    authorizer: QuestbookAuthorizer; // We can change the authorizer by simply swapping out the QuestbookAuthorizer

    constructor(gasTank: GasTankProps, pool: Pool, loadRelayer = true) {
        this.createdAt = gasTank.createdAt;
        this.chainId = gasTank.chainId;
        this.fundingKey = gasTank.fundingKey;
        this.#pool = pool;
        this.providerURL = gasTank.providerURL;
        this.loadRelayer = loadRelayer;
        this.gasTankId = gasTank.gasTankId;
        this.#relayer = new BiconomyRelayer({
            chainId: gasTank.chainId,
            apiKey: gasTank.apiKey,
            providerURL: gasTank.providerURL
        });
        this.authorizer = new QuestbookAuthorizer(gasTank.gasTankId, pool);
        this.readyPromise = this.#relayer.biconomyLoading;
        if (!loadRelayer) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.readyPromise.catch(() => {});
        }
    }
    async addAuthorizedUser(address: string) {
        try {
            await this.authorizer.addAuthorizedUser(address);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async deleteUser(address: string) {
        try {
            await this.authorizer.deleteUser(address);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async doesUserExist(address: string): Promise<boolean> {
        try {
            return await this.authorizer.doesAddressExist(address);
        } catch (e) {
            throw new Error(e as string);
        }
    }
    async getNonce(address: string): Promise<string | boolean> {
        return await this.authorizer.getNonce(address);
    }
    async refreshNonce(address: string): Promise<string> {
        try {
            return await this.authorizer.refreshUserAuthorization(address);
        } catch (e) {
            throw new Error(e as string);
        }
    }
    async buildTransaction(params: BuildTransactionParams): Promise<{
        scwAddress: string;
        safeTXBody: BuildExecTransactionType;
    }> {
        if (
            !(await this.authorizer.isUserAuthorized(
                params.webHookAttributes.signedNonce,
                params.webHookAttributes.nonce,
                params.zeroWalletAddress
            ))
        ) {
            throw new Error('User is not authorized');
        }

        const { doesWalletExist, walletAddress: scwAddress } =
            await this.doesProxyWalletExist(params.zeroWalletAddress);

        if (!doesWalletExist) {
            throw new Error(
                `SCW is not deployed for ${params.zeroWalletAddress}`
            );
        }
        if (!(await this.authorizer.isInWhiteList(params.targetContractAddress))) {
            throw new Error(
                'target contract is not included in the white List'
            );
        }
        try {
            return await this.#relayer.buildExecTransaction(
                params.populatedTx,
                params.targetContractAddress,
                scwAddress
            );
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async sendGaslessTransaction(
        params: SendGaslessTransactionParams
    ): Promise<SendGaslessTransactionType> {
        if (
            !(await this.authorizer.isUserAuthorized(
                params.webHookAttributes.signedNonce,
                params.webHookAttributes.nonce,
                params.zeroWalletAddress
            ))
        ) {
            throw new Error('User is not authorized');
        }

        const { doesWalletExist } = await this.doesProxyWalletExist(
            params.zeroWalletAddress
        );
        if (!doesWalletExist) {
            throw new Error(
                `SCW is not deployed for ${params.zeroWalletAddress}`
            );
        }

        if (!(await this.authorizer.isInWhiteList(params.safeTXBody.to))) {
            throw new Error(
                'target contract is not included in the white List'
            );
        }
        try {
            return await this.#relayer.sendGaslessTransaction(params);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async doesProxyWalletExist(zeroWalletAddress: string): Promise<{
        doesWalletExist: boolean;
        walletAddress: string;
    }> {
        try {
            return await this.#relayer.doesSCWExists(zeroWalletAddress);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async deployProxyWallet(params: deployProxyWalletParams): Promise<string> {
        if (
            !(await this.authorizer.isUserAuthorized(
                params.webHookAttributes.signedNonce,
                params.webHookAttributes.nonce,
                params.zeroWalletAddress
            ))
        ) {
            throw new Error('User is not authorized');
        }

        try {
            const scwAddress = await this.#relayer.deploySCW(
                params.zeroWalletAddress
            );
            await this.authorizer.addToScwWhitelist(scwAddress);
            return scwAddress;
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async addToWhiteList(contractAddress: string): Promise<void> {
        try {
            await this.authorizer.addToScwWhitelist(contractAddress);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async removeFromWhiteList(contractAddress: string): Promise<void> {
        try {
            await this.authorizer.removeContractFromWhitelist(contractAddress);
        } catch (e) {
            throw new Error(e as string);
        }
    }

    async updateGasTankProviderUrl(newProviderUrl: string) {
        if (this.loadRelayer) {
            await this.readyPromise;
        }
        await this.#pool.query(updateGasTankQuery, [
            newProviderUrl,
            this.gasTankId
        ]);

        this.providerURL = newProviderUrl;
    }

    public toString(): string {
        return `GasTank: chainId: ${this.chainId}`;
    }

    public getInfo(): { [key: string]: string } {
        return {
            chainId: this.chainId.toString()
        };
    }
}
