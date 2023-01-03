import { readFileSync } from 'fs';

import { load } from 'js-yaml';
import { Pool } from 'pg';

import { fileDoc } from '../types';
import { isFileDoc } from '../utils/typeChecker';

import { ZeroWallet } from './ZeroWallet';

export class ZeroWalletManager {
    #pool: Pool;

    constructor(path: string) {
        let doc: fileDoc | unknown;

        try {
            doc = load(readFileSync(path, 'utf8'));
            if (!isFileDoc(doc)) {
                throw new Error(
                    'the yml file does not match the required structure'
                );
            }
        } catch (e) {
            throw new Error(e as string);
        }
        const parsedDataBaseConfig = {
            ...doc.databaseConfig,
            port: +doc.databaseConfig.port
        };
        this.#pool = new Pool(parsedDataBaseConfig);
    }

    getZeroWallet(apiKey: string): ZeroWallet {
        return new ZeroWallet(apiKey, this.#pool);
    }
}
