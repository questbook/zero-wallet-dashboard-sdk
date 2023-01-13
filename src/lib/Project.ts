import { Pool } from 'pg';

import {
    addGasTankQuery,
    addMultiGasTankWhitelistQuery,
    getGasTankByChainIdQuery,
    getGasTankByNameQuery,
    getGasTanksByProjectIdQuery,
    getGasTanksByProjectIdRaw
} from '../constants/database';
import {
    GasTankProps,
    GasTankRawType,
    GasTanksType,
    NewGasTankParams,
    ProjectRawType
} from '../types';

import { GasTank } from './GasTank';
import { BiconomyRelayer } from './relayers/BiconomyRelayer';

export default class Project {
    #gasTanks = {} as { [key: string]: GasTank };
    #projectApiKey?: string;
    projectId;
    #pool: Pool;
    #authToken: string;
    readyPromise: Promise<void>;
    owner?: string;
    createdAt?: Date;
    allowedOrigins?: Array<string>;
    name?: string;
    #loadAllOnInit?: boolean;

    constructor(
        whichProject: {
            projectId?: string;
            projectApiKey?: string;
        },
        pool: Pool,
        authToken: string,
        loadAllOnInit?: boolean
    ) {
        const { projectId, projectApiKey } = whichProject;
        if ((!projectApiKey && !projectId) || (projectApiKey && projectId)) {
            throw new Error('either project id or project api key is required');
        }
        this.projectId = projectId;
        this.#projectApiKey = projectApiKey;
        this.#authToken = authToken;
        this.#pool = pool;
        this.#loadAllOnInit = loadAllOnInit;

        this.readyPromise = loadAllOnInit
            ? this.initWithGasTanks()
            : this.#initProjectDetails();
    }

    async addGasTank(
        gasTank: NewGasTankParams,
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
                this.projectId,
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
                    gasTankId,
                    apiKey,
                    ...gasTank,
                    createdAt: now.toDateString(),
                    fundingKey
                },
                this.#pool
            );
        }
    }

    async #getProjectDetailsRow(): Promise<ProjectRawType> {
        if (this.#projectApiKey) {
            const res = await this.#pool.query(
                'SELECT * FROM projects WHERE project_api_key = $1',
                [this.#projectApiKey]
            );
            if (res.rows.length === 0) {
                throw new Error('project not found');
            }
            return res.rows[0];
        }
        const res = await this.#pool.query(
            'SELECT * FROM projects WHERE project_id = $1',
            [this.projectId]
        );
        if (res.rows.length === 0) {
            throw new Error('project not found');
        }
        return res.rows[0];
    }

    async #initProjectDetails(): Promise<void> {
        const projectRow = await this.#getProjectDetailsRow();
        this.owner = projectRow.owner_scw;
        this.createdAt = new Date(projectRow.created_at);
        this.allowedOrigins = projectRow.allowed_origins;
        this.name = projectRow.name;
        this.#projectApiKey = projectRow.project_api_key;
        this.projectId = projectRow.project_id;
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
        await Promise.all([this.#initProjectDetails(), this.initGasTanks()]);
    }

    async #obtainGasTanksFromDatabase(): Promise<GasTanksType> {
        try {
            const res = await this.#pool.query<GasTankProps>(
                getGasTanksByProjectIdQuery,
                [this.projectId]
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
            [this.projectId, chainId]
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

    async loadAndGetGasTankByName(name: string): Promise<GasTank> {
        const { rows } = await this.#pool.query<GasTankProps>(
            getGasTankByNameQuery,
            [this.projectId, name]
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

    async getGasTanksRaw(): Promise<GasTankRawType[]> {
        await this.readyPromise;
        const { rows } = await this.#pool.query<GasTankRawType>(
            getGasTanksByProjectIdRaw,
            [this.projectId]
        );
        return rows;
    }

    getLoadedGasTank(name: string): GasTank {
        return this.#gasTanks[name];
    }

    public get apiKey(): string | undefined {
        return this.#projectApiKey;
    }
}
