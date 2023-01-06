import { Pool } from 'pg';

import {
    addGasTankQuery,
    getGasTanksByProjectIdQuery
} from '../constants/database';
import { GasTankProps, GasTanksType } from '../types';

import { GasTank } from './GasTank';
import { BiconomyRelayer } from './relayers/BiconomyRelayer';

export default class Project {
    #gasTanks = {} as { [key: string]: GasTank };
    #projectApiKey: string;
    #pool: Pool;
    #authToken: string;
    readyPromise: Promise<void>;
    owner?: string;
    createdAt?: Date;
    allowedOrigins?: Array<string>;

    constructor(projectApiKey: string, pool: Pool, authToken: string) {
        this.#projectApiKey = projectApiKey;
        this.#authToken = authToken;
        this.#pool = pool;

        this.readyPromise = this.init();
    }

    async addGasTank(gasTank: Omit<GasTankProps, 'apiKey'>): Promise<void> {
        await this.readyPromise;
        if (this.#gasTanks[gasTank.name] !== undefined) {
            throw new Error('gas tank name should be unique');
        }

        const { apiKey, fundingKey } = await BiconomyRelayer.createGasTank(
            gasTank,
            this.#authToken
        );
        const now = new Date();
        await this.#pool.query(addGasTankQuery, [
            apiKey,
            this.#projectApiKey,
            now,
            gasTank.name,
            gasTank.chainId,
            gasTank.providerURL,
            fundingKey
        ]);

        this.#gasTanks[gasTank.name] = new GasTank(
            {
                apiKey,
                ...gasTank
            },
            this.#pool
        );
    }

    async initProjectDetails(): Promise<void> {
        const res = await this.#pool.query(
            'SELECT * FROM projects WHERE project_id = $1',
            [this.#projectApiKey]
        );
        if (res.rows.length === 0) {
            throw new Error('project not found');
        }
        this.owner = res.rows[0].owner_scw;
        this.createdAt = res.rows[0].created_at;
        this.allowedOrigins = res.rows[0].allowed_origins;
    }

    async initGasTanks(): Promise<void> {
        const gasTanks: GasTanksType = await this.obtainGasTanksFromDatabase();
        console.log('gasTanks', gasTanks);
        if (gasTanks) {
            gasTanks.forEach((gasTank: GasTankProps) => {
                if (this.#gasTanks[gasTank.name] !== undefined) {
                    throw new Error('gas tank name should be unique');
                }
                this.#gasTanks[gasTank.name] = new GasTank(gasTank, this.#pool);
            });
        }
    }

    async init(): Promise<void> {
        await Promise.all([this.initProjectDetails(), this.initGasTanks()]);
    }

    async obtainGasTanksFromDatabase(): Promise<GasTanksType> {
        try {
            const res = await this.#pool.query<GasTankProps>(
                getGasTanksByProjectIdQuery,
                [this.#projectApiKey]
            );
            console.log(res.rows);
            return res.rows;
        } catch (err) {
            throw new Error(err as string);
        }
    }

    getGasTank(name: string): GasTank {
        return this.#gasTanks[name];
    }
}
