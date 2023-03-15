import { PrismaClient } from '@prisma/client';

import { SupportedChainId } from '../constants/chains';
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
    gasTankId: number;

    // private fields
    #prismaClient: PrismaClient;
    #relayer: BiconomyRelayer; // We can simply swap out biconomy by using a different relayer
    authorizer: QuestbookAuthorizer; // We can change the authorizer by simply swapping out the QuestbookAuthorizer

    constructor(
        gasTank: GasTankProps,
        prismaClient: PrismaClient,
        loadRelayer = true
    ) {
        this.createdAt = gasTank.createdAt;
        this.chainId = gasTank.chainId;
        this.fundingKey = gasTank.fundingKey;
        this.#prismaClient = prismaClient;
        this.providerURL = gasTank.providerURL;
        this.loadRelayer = loadRelayer;
        this.gasTankId = parseInt(gasTank.gasTankId);
        this.#relayer = new BiconomyRelayer({
            chainId: gasTank.chainId,
            apiKey: gasTank.apiKey,
            providerURL: gasTank.providerURL
        });
        this.authorizer = new QuestbookAuthorizer(this.gasTankId, prismaClient);
        this.readyPromise = this.#relayer.biconomyLoading;
        if (!loadRelayer) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.readyPromise.catch(() => {});
        }
    }
    async addAuthorizedUser(address: string) {
        await this.authorizer.addAuthorizedUser(address);
    }

    async deleteUser(address: string) {
        await this.authorizer.deleteUser(address);
    }

    async doesUserExist(address: string): Promise<boolean> {
        return await this.authorizer.doesAddressExist(address);
    }
    async getNonce(address: string): Promise<string | boolean> {
        return await this.authorizer.getNonce(address);
    }
    async refreshNonce(address: string): Promise<string> {
        return await this.authorizer.refreshUserAuthorization(address);
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
        if (
            !(await this.authorizer.isInWhiteList(params.targetContractAddress))
        ) {
            throw new Error(
                'target contract is not included in the white List'
            );
        }
        return await this.#relayer.buildExecTransaction(
            params.populatedTx,
            params.targetContractAddress,
            scwAddress
        );
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

        if (!(await this.authorizer.isInWhiteList(params.safeTXBody.to))) {
            throw new Error(
                'target contract is not included in the white List'
            );
        }
        return await this.#relayer.sendGaslessTransaction(params);
    }

    async doesProxyWalletExist(zeroWalletAddress: string): Promise<{
        doesWalletExist: boolean;
        walletAddress: string;
    }> {
        return await this.#relayer.doesSCWExists(zeroWalletAddress);
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

        const scwAddress = await this.#relayer.deploySCW(
            params.zeroWalletAddress
        );
        await this.authorizer.addToScwWhitelist(scwAddress);
        return scwAddress;
    }

    async addToWhiteList(contractAddress: string): Promise<void> {
        await this.authorizer.addToScwWhitelist(contractAddress);
    }

    async removeFromWhiteList(contractAddress: string): Promise<void> {
        await this.authorizer.removeContractFromWhitelist(contractAddress);
    }

    async updateGasTankProviderUrl(newProviderUrl: string) {
        if (this.loadRelayer) {
            await this.readyPromise;
        }

        await this.#prismaClient.gasTank.update({
            where: {
                gasTankId: this.gasTankId
            },
            data: {
                providerUrl: newProviderUrl
            }
        });

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
