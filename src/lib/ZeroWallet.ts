import { Pool } from 'pg';

import { GasTankProps, GasTanksType } from '../types';

import { GasTank } from './GasTank';

export class ZeroWallet {
    #gasTanks = {} as { [key: string]: GasTank };
    #projectApiKey: string;
    #pool: Pool;

    constructor(projectApiKey: string, pool: Pool) {
        this.#projectApiKey = projectApiKey;
        this.#pool = pool;

        const gasTanks: GasTanksType = this.obtainGasTanksFromDatabase();

        if (gasTanks) {
            gasTanks.forEach((gasTank: GasTankProps) => {
                if (this.#gasTanks[gasTank.name] !== undefined) {
                    throw new Error('gas tank name should be unique');
                }
                this.#gasTanks[gasTank.name] = new GasTank(gasTank, this.#pool);
            });
        }
    }

    async obtainGasTanksFromDatabase(): Promise<GasTanksType> {
        try {
            const res = await this.#pool.query(
                'SELECT * FROM gas_tanks WHERE project_api_key = $1',
                [this.#projectApiKey]
            );
            return res.rows;
        } catch (err) {
            throw new Error(err as string);
        }
    }

    getGasTank(name: string): GasTank {
        return this.#gasTanks[name];
    }
}
