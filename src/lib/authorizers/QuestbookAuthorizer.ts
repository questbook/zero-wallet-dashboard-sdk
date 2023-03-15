import { ContractsWhitelist, GaslessLogin, PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

import { NONCE_EXPIRATION } from '../../constants/database';
import { SignedMessage } from '../../types';

import { BaseAuthorizer } from './BaseAuthorizer';

export default class QuestbookAuthorizer implements BaseAuthorizer {
    name = 'Questbook Auhorizer';
    #prismaClient: PrismaClient;
    // loadingTableCreationWithIndex: Promise<void>;
    #gasTankId: number;

    constructor(gasTankId: number, prismaClient: PrismaClient) {
        this.#prismaClient = prismaClient;
        this.#gasTankId = gasTankId;
    }

    async endConnection() {
        await this.#prismaClient.$disconnect();
    }

    async #getGaslessLoginFromPrisma(
        address: string
    ): Promise<GaslessLogin | null> {
        return await this.#prismaClient.gaslessLogin.findUnique({
            where: {
                gasTankId_address: {
                    gasTankId: this.#gasTankId,
                    address
                }
            }
        });
    }

    async #getContractWhitelistFromPrisma(
        contractAddress: string
    ): Promise<ContractsWhitelist | null> {
        return await this.#prismaClient.contractsWhitelist.findUnique({
            where: {
                gasTankId_address: {
                    address: contractAddress,
                    gasTankId: this.#gasTankId
                }
            }
        });
    }

    async isInWhiteList(contractAddress: string): Promise<boolean> {
        const contractWhitelist = await this.#getContractWhitelistFromPrisma(
            contractAddress
        );
        if (!contractWhitelist) {
            return false;
        }
        return true;
    }

    async removeContractFromWhitelist(contractAddress: string): Promise<void> {
        if (!(await this.isInWhiteList(contractAddress))) {
            throw new Error('Contract is not in whitelist!');
        }
        try {
            await this.#prismaClient.contractsWhitelist.delete({
                where: {
                    gasTankId_address: {
                        gasTankId: this.#gasTankId,
                        address: contractAddress
                    }
                }
            });
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async addToScwWhitelist(contractAddress: string): Promise<void> {
        if (await this.isInWhiteList(contractAddress)) return;
        try {
            await this.#prismaClient.contractsWhitelist.create({
                data: {
                    address: contractAddress,
                    gasTankId: this.#gasTankId
                }
            });
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async addAuthorizedUser(address: string) {
        if (await this.doesAddressExist(address)) {
            throw new Error(
                'User already registered! Please use refreshUserAuthorization instead.'
            );
        }

        const newNonce = this.#createNonce(100);

        try {
            await this.#prismaClient.gaslessLogin.create({
                data: {
                    address,
                    nonce: newNonce,
                    expiration:
                        NONCE_EXPIRATION +
                        Math.trunc(new Date().getTime() / 1000),
                    gasTankId: this.#gasTankId
                }
            });
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async deleteUser(address: string): Promise<void> {
        if (!(await this.doesAddressExist(address))) {
            throw new Error('User does not exist!');
        }
        try {
            await this.#prismaClient.gaslessLogin.delete({
                where: {
                    gasTankId_address: {
                        gasTankId: this.#gasTankId,
                        address
                    }
                }
            });
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async refreshUserAuthorization(address: string) {
        if (!(await this.doesAddressExist(address))) {
            throw new Error('User is not registered!');
        }

        const newNonce = this.#createNonce(100);
        await this.#prismaClient.gaslessLogin.update({
            where: {
                gasTankId_address: {
                    address,
                    gasTankId: this.#gasTankId
                }
            },
            data: {
                nonce: newNonce
            }
        });
        return newNonce;
    }

    async isUserAuthorized(
        signedNonce: SignedMessage,
        nonce: string,
        webwalletAddress: string
    ) {
        try {
            if (!(await this.doesAddressExist(webwalletAddress))) {
                throw new Error('User is not registered!');
            }
        } catch (err) {
            throw new Error(err as string);
        }

        const address = this.#recoverAddress(signedNonce);

        if (address !== webwalletAddress) {
            return false;
        }

        if (ethers.utils.hashMessage(nonce) !== signedNonce.transactionHash) {
            return false;
        }

        return await this.#retrieveValidRecord(address, nonce);
    }

    async #retrieveValidRecord(address: string, nonce: string) {
        const gaslessLogin = await this.#getGaslessLoginFromPrisma(address);

        if (!gaslessLogin || gaslessLogin.nonce !== nonce) {
            return false;
        }

        const expiration = gaslessLogin.expiration;

        const curDate = new Date().getTime() / 1000;

        return expiration > curDate;
    }

    async doesAddressExist(address: string): Promise<boolean> {
        try {
            const doesExist = !!(await this.#getGaslessLoginFromPrisma(
                address
            ));
            return doesExist;
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async getNonce(address: string): Promise<boolean | string> {
        const gaslessLogin = await this.#getGaslessLoginFromPrisma(address);

        if (!gaslessLogin) {
            return false;
        }

        if (gaslessLogin.expiration <= new Date().getTime() / 1000) {
            return false;
        }

        return gaslessLogin.nonce;
    }

    #createNonce = (length: number) => {
        let result = '';

        const characters =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;

        for (let i = 0; i < length; i++) {
            result += characters.charAt(
                Math.floor(Math.random() * charactersLength)
            );
        }

        return result;
    };

    #recoverAddress(signedMessage: SignedMessage) {
        const address = ethers.utils.recoverAddress(
            signedMessage.transactionHash,
            {
                r: signedMessage.r,
                s: signedMessage.s,
                v: signedMessage.v
            }
        );

        return address;
    }
}
