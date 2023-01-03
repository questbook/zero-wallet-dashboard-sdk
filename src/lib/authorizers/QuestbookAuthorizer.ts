import { ethers } from 'ethers';
import { Pool } from 'pg';

import {
    createGaslessLoginTableQuery,
    createIndexForGasLessLoginTable,
    createIndexForScwWhitelistTable,
    createScwWhitelistTable,
    dropGaslessLoginTableQuery,
    dropScwWhitelistTable,
    NONCE_EXPIRATION
} from '../../constants/database';
import { DatabaseConfig, SignedMessage } from '../../types';

import { BaseAuthorizer } from './BaseAuthorizer';

export default class QuestbookAuthorizer implements BaseAuthorizer {
    name = 'Questbook Auhorizer';
    #pool: Pool;
    #whiteList: Array<string>;
    loadingTableCreationWithIndex: Promise<void>;
    #gasTankID: string;

    constructor(
        databaseConfig: DatabaseConfig,
        whiteList: string[],
        gasTankID: string
    ) {
        const parsedDataBaseConfig = {
            ...databaseConfig,
            port: +databaseConfig.port
        };
        this.#pool = new Pool(parsedDataBaseConfig);
        this.loadingTableCreationWithIndex = this.getDatabaseReadyWithIndex();
        this.#whiteList = whiteList;

        this.#gasTankID = gasTankID;
    }
    async endConnection() {
        await this.#pool.end();
    }

    async isInWhiteList(contractAddress: string): Promise<boolean> {
        if (this.#whiteList.includes(contractAddress)) return true;

        const results = await this.#query(
            'SELECT * FROM scwWhitelist WHERE address = $1 AND gasTankID = $2 ;',
            [contractAddress, this.#gasTankID]
        );
        if (results.rows.length === 0) {
            return false;
        }
        return true;
    }
    async addToScwWhitelist(contractAddress: string): Promise<void> {
        if (await this.isInWhiteList(contractAddress)) return;
        try {
            await this.#query('INSERT INTO scwWhitelist VALUES ($1, $2);', [
                contractAddress,
                this.#gasTankID
            ]);
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
            await this.#query(
                `INSERT INTO gasless_login VALUES ($1, $2, $3, $4);`,
                [
                    address,
                    newNonce,
                    NONCE_EXPIRATION + Math.trunc(new Date().getTime() / 1000),
                    this.#gasTankID
                ]
            );
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async deleteUser(address: string): Promise<void> {
        if (!(await this.doesAddressExist(address))) {
            throw new Error('User does not exist!');
        }
        try {
            await this.#query(
                'DELETE FROM gasless_login WHERE address = $1 AND gasTankID = $2 ;',
                [address, this.#gasTankID]
            );
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async refreshUserAuthorization(address: string) {
        if (!(await this.doesAddressExist(address))) {
            throw new Error('User is not registered!');
        }

        const newNonce = this.#createNonce(100);

        await this.#query(
            'UPDATE gasless_login SET nonce = $1 WHERE address = $2 AND gasTankID = $3;',
            [newNonce, address, this.#gasTankID]
        );

        return newNonce;
    }

    async isUserAuthorized(
        signedNonce: SignedMessage,
        nonce: string,
        webwallet_address: string
    ) {
        try {
            if (!(await this.doesAddressExist(webwallet_address))) {
                throw new Error('User is not registered!');
            }
        } catch (err) {
            throw new Error(err as string);
        }

        const address = this.#recoverAddress(signedNonce);

        if (address !== webwallet_address) {
            return false;
        }

        if (ethers.utils.hashMessage(nonce) !== signedNonce.transactionHash) {
            return false;
        }

        return await this.#retrieveValidRecord(address, nonce);
    }

    async getDatabaseReadyWithIndex() {
        // @todo: to be removed after testing
        try {
            await this.#pool.query(dropGaslessLoginTableQuery);
            await this.#pool.query(dropScwWhitelistTable);
        } catch {
            console.log('table does not exist');
        }
        try {
            await this.#pool.query(createGaslessLoginTableQuery);
            await this.#pool.query(createScwWhitelistTable);
        } catch (err) {
            throw new Error(err as string);
        }
        try {
            await this.#pool.query(createIndexForGasLessLoginTable);
        } catch (err) {
            console.log('error creating index in gasless_login table');
        }
        try {
            await this.#pool.query(createIndexForScwWhitelistTable);
        } catch (err) {
            console.log('error creating index in whitelist table');
        }
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async #query(query: string, values?: Array<any>): Promise<any> {
        try {
            await this.loadingTableCreationWithIndex;
            const res = await this.#pool.query(query, values);
            return res;
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async #retrieveValidRecord(address: string, nonce: string) {
        const results = await this.#query(
            'SELECT * FROM gasless_login WHERE address = $1 AND nonce = $2 ANd gasTankID = $3;',
            [address, nonce, this.#gasTankID]
        );

        if (results.rows.length === 0) {
            return false;
        }

        const expiration = results.rows[0].expiration;

        const curDate = new Date().getTime() / 1000;

        return expiration > curDate;
    }

    async doesAddressExist(address: string): Promise<boolean> {
        try {
            const results = await this.#query(
                'SELECT * FROM gasless_login WHERE address = $1 AND gasTankID= $2 ;',
                [address, this.#gasTankID]
            );
            return results.rows.length > 0;
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async getNonce(address: string): Promise<boolean | string> {
        const results = await this.#query(
            'SELECT nonce, expiration FROM gasless_login WHERE address = $1 AND gasTankID = $2 ORDER BY expiration DESC',
            [address, this.#gasTankID]
        );

        if (results.rows.length === 0) {
            return false;
        }

        if (results.rows[0].expiration <= new Date().getTime() / 1000) {
            return false;
        }

        return results.rows[0].nonce;
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
