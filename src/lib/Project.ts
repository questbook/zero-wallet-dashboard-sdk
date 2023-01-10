import { Pool } from 'pg';

import {
    addGasTankQuery,
    addMultiGasTankWhitelistQuery,
    getGasTankByChainIdQuery,
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
    name?: string;
    #loadAllOnInit?: boolean;

    constructor(
        projectApiKey: string,
        pool: Pool,
        authToken: string,
        loadAllOnInit?: boolean
    ) {
        this.#projectApiKey = projectApiKey;
        this.#authToken = authToken;
        this.#pool = pool;
        this.#loadAllOnInit = loadAllOnInit;

        this.readyPromise = loadAllOnInit
            ? this.initWithGasTanks()
            : this.initProjectDetails();
    }

    async addGasTank(
        gasTank: Omit<GasTankProps, 'apiKey' | 'createdAt'>,
        whiteList: string[]
    ): Promise<void> {
        await this.readyPromise;
        if (this.#gasTanks[gasTank.name] !== undefined) {
            throw new Error('gas tank name should be unique');
        }

        const { apiKey, fundingKey } = await BiconomyRelayer.createGasTank(
            gasTank,
            this.#authToken
        );
        const now = new Date();
        const gasTankId = (
            await this.#pool.query(addGasTankQuery, [
                apiKey,
                this.#projectApiKey,
                now,
                gasTank.name,
                gasTank.chainId,
                gasTank.providerURL,
                fundingKey
            ])
        ).rows[0].gas_tank_id;

        const gasTankIdList = Array(whiteList.length).fill(gasTankId);
        await this.#pool.query(addMultiGasTankWhitelistQuery, [
            whiteList,
            gasTankIdList
        ]);

        if (this.#loadAllOnInit) {
            this.#gasTanks[gasTank.name] = new GasTank(
                {
                    apiKey,
                    ...gasTank,
                    createdAt: now.toDateString()
                },
                this.#pool
            );
        }
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
        this.name = res.rows[0].name;
    }

    async initGasTanks(): Promise<void> {
        const gasTanks: GasTanksType = await this.#obtainGasTanksFromDatabase();
        if (gasTanks) {
            await Promise.all(
                gasTanks.map(async (gasTank: GasTankProps) => {
                    if (this.#gasTanks[gasTank.name] !== undefined) {
                        throw new Error('gas tank name should be unique');
                    }
                    this.#gasTanks[gasTank.name] = new GasTank(
                        gasTank,
                        this.#pool
                    );
                    await this.#gasTanks[gasTank.name].readyPromise;
                })
            );
        }
    }

    async initWithGasTanks(): Promise<void> {
        await Promise.all([this.initProjectDetails(), this.initGasTanks()]);
    }

    async #obtainGasTanksFromDatabase(): Promise<GasTanksType> {
        try {
            const res = await this.#pool.query<GasTankProps>(
                getGasTanksByProjectIdQuery,
                [this.#projectApiKey]
            );
            return res.rows.map((gasTank: GasTankProps) => ({
                ...gasTank,
                fundingKey: +gasTank.fundingKey
            }));
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async loadAndGetGasTankByChainId(chainId: number): Promise<GasTank> {
        const { rows } = await this.#pool.query<GasTankProps>(
            getGasTankByChainIdQuery,
            [this.#projectApiKey, chainId]
        );
        if (rows.length === 0) {
            throw new Error('gas tank not found');
        }
        const gasTankProps = {
            ...rows[0],
            fundingKey: +rows[0].fundingKey
        };
        const gasTank = new GasTank(gasTankProps, this.#pool);
        return gasTank;
    }

    getLoadedGasTank(name: string): GasTank {
        return this.#gasTanks[name];
    }

    public get apiKey(): string {
        return this.#projectApiKey;
    }
}
