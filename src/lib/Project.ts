import { PrismaClient } from '@prisma/client';

import { SupportedChainId } from '../constants/chains';
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
    #prismaClient: PrismaClient;
    projectId;
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
        prismaClient: PrismaClient,
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
        this.#prismaClient = prismaClient;
        this.#loadAllOnInit = loadAllOnInit;

        this.readyPromise = loadAllOnInit
            ? this.initWithGasTanks()
            : this.#initProjectDetails();
    }

    async doesGasTankExist(chainId: SupportedChainId): Promise<boolean> {
        await this.readyPromise;
        const gasTank = await this.#prismaClient.gasTank.findUnique({
            where: {
                projectId_chainId: {
                    projectId: this.projectId!,
                    chainId
                }
            }
        });
        return !!gasTank;
    }

    async addGasTank(
        gasTank: NewGasTankParams,
        whiteList: string[]
    ): Promise<GasTankRawType> {
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

        const { gasTankId } = await this.#prismaClient.gasTank.create({
            data: {
                apiKey,
                projectId: this.projectId!,
                createdAt: now,
                chainId: gasTank.chainId,
                providerUrl: gasTank.providerURL,
                fundingKey
            },
            select: {
                gasTankId: true
            }
        });

        await this.#prismaClient.contractsWhitelist.createMany({
            data: whiteList.map((address) => ({
                address,
                gasTankId
            }))
        });

        return {
            gas_tank_id: gasTankId.toString(),
            project_id: this.projectId!,
            created_at: now.toISOString(),
            chain_id: gasTank.chainId.toString(),
            provider_url: '',
            funding_key: fundingKey.toString(),
            whitelist: whiteList,
            balance: '0'
        };
    }

    async #getProjectDetailsRow(): Promise<ProjectRawType> {
        let project;
        if (this.#projectApiKey) {
            project = await this.#prismaClient.project.findUnique({
                where: {
                    projectApiKey: this.#projectApiKey
                }
            });
        } else {
            project = await this.#prismaClient.project.findUnique({
                where: {
                    projectId: this.projectId
                }
            });
        }
        if (!project) {
            throw new Error('project not found');
        }
        return {
            project_id: project.projectId,
            owner_scw: project.ownerScw,
            created_at: project.createdAt.toUTCString(),
            allowed_origins: project.allowedOrigins,
            name: project.name,
            project_api_key: project.projectApiKey
        };
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
                        this.#prismaClient
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
        const gasTanks = await this.#prismaClient.gasTank.findMany({
            where: {
                projectId: this.projectId
            }
        });
        return gasTanks.map((gasTank) => ({
            apiKey: gasTank.apiKey,
            gasTankId: gasTank.gasTankId.toString(),
            providerURL: gasTank.providerUrl,
            createdAt: gasTank.createdAt.toUTCString(),
            chainId: gasTank.chainId.toString() as unknown as SupportedChainId,
            fundingKey: Number(gasTank.fundingKey)
        }));
    }

    async updateProject(
        newName: string,
        newAllowedOrigins: string[]
    ): Promise<void> {
        await this.readyPromise;
        await this.#prismaClient.project.update({
            where: {
                projectId: this.projectId
            },
            data: {
                name: newName,
                allowedOrigins: newAllowedOrigins
            }
        });
        this.name = newName;
        this.allowedOrigins = newAllowedOrigins;
    }

    async loadAndGetGasTankByChainId(
        chainId: number,
        loadRelayer = true
    ): Promise<GasTank> {
        await this.readyPromise;
        const gasTankProps = await this.#prismaClient.gasTank.findUnique({
            where: {
                projectId_chainId: {
                    projectId: this.projectId!,
                    chainId
                }
            }
        });
        if (!gasTankProps) {
            throw new Error('gas tank not found');
        }
        const gasTankProps2 = {
            apiKey: gasTankProps.apiKey.toString(),
            gasTankId: gasTankProps.gasTankId.toString(),
            providerURL: gasTankProps.providerUrl,
            createdAt: gasTankProps.createdAt.toUTCString(),
            chainId:
                gasTankProps.chainId.toString() as unknown as SupportedChainId,
            fundingKey: Number(gasTankProps.fundingKey)
        };
        const gasTank = new GasTank(
            gasTankProps2,
            this.#prismaClient,
            loadRelayer
        );
        return gasTank;
    }

    async getGasTanksRaw(): Promise<GasTankRawType[]> {
        await this.readyPromise;

        const gasTanksProps = await this.#prismaClient.gasTank.findMany({
            where: {
                projectId: this.projectId!
            },
            include: {
                contractsWhitelist: true
            }
        });

        const newRowsPromises = gasTanksProps.map(async (gasTank) => {
            return {
                gas_tank_id: gasTank.gasTankId.toString(),
                project_id: gasTank.projectId,
                chain_id: gasTank.chainId.toString(),
                provider_url: '',
                created_at: gasTank.createdAt.toUTCString(),
                funding_key: gasTank.fundingKey.toString(),
                whitelist: gasTank.contractsWhitelist.map(
                    (contract) => contract.address
                ),
                balance: (
                    await BiconomyRelayer.getGasTankBalance(
                        gasTank.apiKey,
                        this.#authToken
                    )
                ).toString()
            };
        });
        const newRows = await Promise.all(newRowsPromises);
        return newRows;
    }

    async getLoadedGasTank(chainId: string): Promise<GasTank> {
        await this.readyPromise;
        return this.#gasTanks[chainId];
    }

    public get apiKey(): string | undefined {
        return this.#projectApiKey;
    }
}
