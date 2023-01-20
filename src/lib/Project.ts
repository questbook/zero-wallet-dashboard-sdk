import { Pool } from 'pg';

import { SupportedChainId } from '../constants/chains';
import {
    addGasTankQuery,
    addMultiGasTankWhitelistQuery,
    getGasTankByChainIdQuery,
    getGasTanksByProjectIdQuery,
    getGasTanksByProjectIdRaw,
    updateProjectNameAndAllowedOriginsQuery
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

    async doesGasTankExist(chainId: SupportedChainId): Promise<boolean> {
        await this.readyPromise;
        const { rows } = await this.#pool.query(getGasTankByChainIdQuery, [
            this.projectId,
            chainId
        ]);
        return rows.length > 0;
    }

    async addGasTank(
        gasTank: NewGasTankParams,
        whiteList: string[]
    ): Promise<void> {
        await this.readyPromise;

        if (await this.doesGasTankExist(gasTank.chainId)) {
            throw new Error('gas tank chain id should be unique');
        }
        const gasTankName = `gas-tank-${this.projectId}-${gasTank.chainId}`;
        const { apiKey, fundingKey } = await BiconomyRelayer.createGasTank(
            gasTank,
            gasTankName,
            this.#authToken
        );
        const now = new Date();
        const gasTankId = (
            await this.#pool.query<{gas_tank_id: string}>(addGasTankQuery, [
                apiKey,
                this.projectId,
                now,
                gasTank.chainId,
                gasTank.providerURL,
                fundingKey
            ])
        ).rows[0].gas_tank_id;

        const gasTankIdList = Array<string>(whiteList.length).fill(gasTankId);
        await this.#pool.query(addMultiGasTankWhitelistQuery, [
            whiteList,
            gasTankIdList
        ]);
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
                    this.#gasTanks[gasTank.chainId] = new GasTank(
                        gasTank,
                        this.#pool
                    );
                    await this.#gasTanks[gasTank.chainId].readyPromise;
                })
            );
        }
    }

    async initWithGasTanks(): Promise<void> {
        await Promise.all([this.#initProjectDetails(), this.initGasTanks()]);
    }

    async #obtainGasTanksFromDatabase(): Promise<GasTanksType> {
        await this.readyPromise;
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

    async updateProject(
        newName: string,
        newAllowedOrigins: string[]
    ): Promise<void> {
        await this.readyPromise;
        await this.#pool.query(updateProjectNameAndAllowedOriginsQuery, [
            newName,
            newAllowedOrigins,
            this.projectId
        ]);
        this.name = newName;
        this.allowedOrigins = newAllowedOrigins;
    }

    async loadAndGetGasTankByChainId(
        chainId: number,
        loadRelayer = true
    ): Promise<GasTank> {
        await this.readyPromise;
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
        const gasTank = new GasTank(gasTankProps, this.#pool, loadRelayer);
        return gasTank;
    }

    async getGasTanksRaw(): Promise<GasTankRawType[]> {
        await this.readyPromise;

        const { rows } = await this.#pool.query<
            Omit<GasTankRawType, 'balance'> & { api_key: string }
        >(getGasTanksByProjectIdRaw, [this.projectId]);
        const newRowsPromises = rows.map(async (row) => {
            return {
                ...row,
                api_key: undefined,
                balance: (await BiconomyRelayer.getGasTankBalance(row.api_key, this.#authToken)).toString()
            };
        });
        const newRows = await Promise.all(newRowsPromises);
        return newRows
    }

    async getLoadedGasTank(chainId: string): Promise<GasTank> {
        await this.readyPromise;
        return this.#gasTanks[chainId];
    }

    public get apiKey(): string | undefined {
        return this.#projectApiKey;
    }
}
