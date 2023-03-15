import { readFileSync } from 'fs';

import { PrismaClient } from '@prisma/client';
import { load } from 'js-yaml';

import {
    fileDoc,
    NativeGasTankType,
    NativeProjectType,
    ProjectRawType
} from '../types';
import { isFileDoc } from '../utils/typeChecker';

import Project from './Project';

export default class ProjectsManager {
    #prismaClient: PrismaClient;
    #authToken: string;
    readyPromise: Promise<void>;
    isTesting: boolean;
    nativeProject: NativeProjectType;
    nativeGasTanks: { [key: string]: NativeGasTankType };

    /**
     *
     * @param path the path to the yml file which includes the database config and the auth token.
     * @param isTesting if true, the database will be cleared before starting the server.
     */
    constructor(path: string, isTesting?: boolean) {
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
        this.isTesting = isTesting || false;
        this.nativeProject = doc.project;
        this.nativeGasTanks = doc.gasTanks;
        this.#authToken = doc.authToken;
        // const parsedDataBaseConfig = {
        //     ...doc.databaseConfig,
        //     port: +doc.databaseConfig.port
        // };
        // this.#pool = new Pool(parsedDataBaseConfig);
        // @todo add prisma client config
        this.#prismaClient = new PrismaClient();

        this.readyPromise = this.#addNativeEntries();
    }

    async endConnection() {
        await this.#prismaClient.$disconnect();
    }

    async #addNativeEntries() {
        await this.#addNativeProject();
        await this.#addNativeGasTanks();
    }

    async #doesNativeProjectExist(): Promise<boolean> {
        const projects = await this.#prismaClient.project.findMany({
            where: {
                ownerScw: this.nativeProject.ownerScw
            }
        });

        if (projects.length === 0) {
            return false;
        }

        if (projects.length > 1) {
            throw new Error('there are more than one project with the owner');
        }

        const project = projects[0];
        if (
            project.projectApiKey !== this.nativeProject.apiKey ||
            project.name !== this.nativeProject.name ||
            project.projectId !== this.nativeProject.projectId
        ) {
            throw new Error(
                'the native project already exists but with different values'
            );
        }

        return true;
    }

    async #addNativeProject() {
        const now = new Date();

        if (await this.#doesNativeProjectExist()) return;

        await this.#prismaClient.project.create({
            data: {
                projectId: this.nativeProject.projectId,
                projectApiKey: this.nativeProject.apiKey,
                name: this.nativeProject.name,
                createdAt: now,
                ownerScw: this.nativeProject.ownerScw
            }
        });
    }

    async #removeAllNativeGasTanks() {
        await this.#prismaClient.gasTank.deleteMany({
            where: {
                projectId: this.nativeProject.projectId
            }
        });
    }

    async #addNativeGasTanks() {
        await this.#removeAllNativeGasTanks();

        const now = new Date();
        await this.#prismaClient.gasTank.createMany({
            data: Object.keys(this.nativeGasTanks).map((key) => ({
                apiKey: this.nativeGasTanks[key].apiKey,
                chainId: this.nativeGasTanks[key].chainId,
                fundingKey: this.nativeGasTanks[key].fundingKey,
                projectId: this.nativeProject.projectId,
                createdAt: now,
                providerUrl: this.nativeGasTanks[key].providerURL
            }))
        });
    }

    async addProject(
        name: string,
        ownerScw: string,
        allowedOrigins: Array<string>
    ) {
        await this.readyPromise;
        const createdAt = new Date();
        try {
            const { projectId } = await this.#prismaClient.project.create({
                data: {
                    name,
                    createdAt,
                    ownerScw,
                    allowedOrigins
                },
                select: {
                    projectId: true
                }
            });
            return new Project(
                { projectId: projectId },
                this.#prismaClient,
                this.#authToken
            );
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async removeProject(projectId: string) {
        await this.readyPromise;
        try {
            await this.#prismaClient.project.delete({
                where: {
                    projectId
                }
            });
        } catch (err) {
            console.log(err);
            throw new Error(err as string);
        }
    }

    async getProjectsCount() {
        await this.readyPromise;
        const count = await this.#prismaClient.project.count();
        return count;
    }

    async getAllProjectsOwnerRaw(ownerScw: string): Promise<ProjectRawType[]> {
        await this.readyPromise;

        const projects = await this.#prismaClient.project.findMany({
            where: {
                ownerScw
            }
        });

        return projects.map((project) => ({
            project_id: project.projectId,
            project_api_key: project.projectApiKey,
            name: project.name,
            created_at: project.createdAt.toISOString(),
            owner_scw: project.ownerScw,
            allowed_origins: project.allowedOrigins
        }));
    }

    async getProjectByApiKey(
        projectApiKey: string,
        loadAllOnInit?: boolean
    ): Promise<Project> {
        await this.readyPromise;
        return new Project(
            { projectApiKey },
            this.#prismaClient,
            this.#authToken,
            loadAllOnInit
        );
    }

    async getProjectById(
        projectId: string,
        loadAllOnInit?: boolean
    ): Promise<Project> {
        await this.readyPromise;
        return new Project(
            { projectId },
            this.#prismaClient,
            this.#authToken,
            loadAllOnInit
        );
    }
}
