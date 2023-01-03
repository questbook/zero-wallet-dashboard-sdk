import { readFileSync } from 'fs';

import { load } from 'js-yaml';

import { DatabaseConfig, fileDoc, GasTankProps, GasTanksType } from '../types';
import { isFileDoc } from '../utils/typeChecker';

import { GasTank } from './GasTank';

export class ZeroWallet {
    #gasTanks = {} as { [key: string]: GasTank };
    #databaseConfig: DatabaseConfig;

    constructor(path: string) {
        let doc: fileDoc | unknown;

        try {
            doc = load(readFileSync(path, 'utf8'));
            isFileDoc(doc);
            if (!isFileDoc(doc)) {
                throw new Error(
                    'the yml file does not match the required structure'
                );
            }
        } catch (e) {
            throw new Error(e as string);
        }

        this.#databaseConfig = doc.databaseConfig;
        const gasTanks: GasTanksType = doc.gasTanks;

        if (gasTanks) {
            gasTanks.forEach((gasTank: GasTankProps) => {
                if (this.#gasTanks[gasTank.name] !== undefined) {
                    throw new Error('gas tank name should be unique');
                }
                this.#gasTanks[gasTank.name] = new GasTank(
                    gasTank,
                    this.#databaseConfig
                );
            });
        }
    }

    getGasTank(name: string): GasTank {
        return this.#gasTanks[name];
    };
}
