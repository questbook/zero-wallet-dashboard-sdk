import { readFileSync } from 'fs';

import { load } from 'js-yaml';
import { Pool } from 'pg';

import {
    addNativeGasTanksQuery,
    addNativeProjectQuery,
    addProjectQuery,
    createContractsWhitelistTable,
    createGaslessLoginTableQuery,
    createGasTanksTableQuery,
    createProjectsTableQuery,
    deleteNativeGasTanksQuery,
    deleteProjectQuery,
    dropContractsWhitelistTable,
    dropGaslessLoginTableQuery,
    dropGasTanksTableQuery,
    dropProjectsTableQuery,
    getProjectsByOwnerQuery,
    indices
} from '../constants/database';
import {
    fileDoc,
    NativeGasTankType,
    NativeProjectType,
    ProjectRawType
} from '../types';
import { isFileDoc } from '../utils/typeChecker';

import Project from './Project';

export default class ProjectsManager {
    #pool: Pool;
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
        const parsedDataBaseConfig = {
            ...doc.databaseConfig,
            port: +doc.databaseConfig.port
        };
        this.#pool = new Pool(parsedDataBaseConfig);
        this.readyPromise = this.getDatabaseReadyWithIndex();
    }

    async #clearDatabase() {
        try {
            await this.#pool.query(dropGaslessLoginTableQuery);
            await this.#pool.query(dropContractsWhitelistTable);
            await this.#pool.query(dropGasTanksTableQuery);
            await this.#pool.query(dropProjectsTableQuery);
        } catch {
            console.log('table does not exist');
        }
    }

    async #createTables() {
        try {
            await this.#pool.query(createProjectsTableQuery);
            await this.#pool.query(createGasTanksTableQuery);
            await this.#pool.query(createGaslessLoginTableQuery);
            await this.#pool.query(createContractsWhitelistTable);
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async #createIndices() {
        const queryPromises = indices.map((query) => this.#pool.query(query));
        await Promise.allSettled(queryPromises);
    }

    async endConnection() {
        await this.#pool.end();
    }

    async getDatabaseReadyWithIndex() {
        if (this.isTesting) {
            await this.#clearDatabase();
        }

        await this.#createTables();
        await this.#createIndices();

        await this.#addNativeEntries();
    }

    async #addNativeEntries() {
        await this.#addNativeProject();
        await this.#addNativeGasTanks();
    }

    async #doesNativeProjectExist(): Promise<boolean> {
        const { rows } = await this.#pool.query<ProjectRawType>(
            getProjectsByOwnerQuery,
            [this.nativeProject.ownerScw]
        );

        if (rows.length === 0) {
            return false;
        }

        if (rows.length > 1) {
            throw new Error('there are more than one project with the owner');
        }

        const project = rows[0];
        if (
            project.project_api_key !== this.nativeProject.apiKey ||
            project.name !== this.nativeProject.name ||
            project.project_id !== this.nativeProject.projectId
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

        await this.#pool.query(addNativeProjectQuery, [
            this.nativeProject.projectId,
            this.nativeProject.apiKey,
            this.nativeProject.name,
            now,
            this.nativeProject.ownerScw,
            this.nativeProject.allowedOrigins
        ]);
    }

    async #removeAllNativeGasTanks() {
        await this.#pool.query(deleteNativeGasTanksQuery, [
            this.nativeProject.projectId
        ]);
    }

    #getNativeGasTanksLists() {
        const now = new Date();
        const apiKeyList = Object.keys(this.nativeGasTanks).map(
            (key) => this.nativeGasTanks[key].apiKey
        );
        const projectIdList = Array<string>(apiKeyList.length).fill(
            this.nativeProject.projectId
        );
        const createdAtList = Array<Date>(apiKeyList.length).fill(now);
        const chainIdList = Object.keys(this.nativeGasTanks).map(
            (key) => this.nativeGasTanks[key].chainId
        );
        const providerURLList = Object.keys(this.nativeGasTanks).map(
            (key) => this.nativeGasTanks[key].providerURL
        );
        const fundingKeyList = Object.keys(this.nativeGasTanks).map(
            (key) => this.nativeGasTanks[key].fundingKey
        );

        return {
            apiKeyList,
            projectIdList,
            createdAtList,
            chainIdList,
            providerURLList,
            fundingKeyList
        };
    }

    async #addNativeGasTanks() {
        await this.#removeAllNativeGasTanks();

        const {
            apiKeyList,
            projectIdList,
            createdAtList,
            chainIdList,
            providerURLList,
            fundingKeyList
        } = this.#getNativeGasTanksLists();

        await this.#pool.query(addNativeGasTanksQuery, [
            apiKeyList,
            projectIdList,
            createdAtList,
            chainIdList,
            providerURLList,
            fundingKeyList
        ]);
    }

    async addProject(
        name: string,
        ownerScw: string,
        allowedOrigins: Array<string>
    ) {
        await this.readyPromise;
        const createAt = new Date();
        let projectId;
        try {
            projectId = await this.#pool.query<{ project_id: string }>(
                addProjectQuery,
                [name, createAt, ownerScw, allowedOrigins]
            );
        } catch (err) {
            throw new Error(err as string);
        }
        return new Project(
            { projectId: projectId.rows[0].project_id },
            this.#pool,
            this.#authToken
        );
    }

    async removeProject(projectId: string) {
        await this.readyPromise;
        try {
            await this.#pool.query(deleteProjectQuery, [projectId]);
        } catch (err) {
            console.log(err);
            throw new Error(err as string);
        }
    }

    async getEstimateProjectCount() {
        await this.readyPromise;
        const projects = await this.#pool.query<{ estimate: string }>(
            'SELECT reltuples AS estimate FROM pg_class where relname = $1 ;',
            ['projects']
        );
        return +projects.rows[0].estimate;
    }

    async getProjectsCount() {
        await this.readyPromise;
        const projects = await this.#pool.query<{ count: string }>(
            'SELECT COUNT(*) FROM projects;'
        );
        return +projects.rows[0].count;
    }

    async getAllProjectsOwnerRaw(ownerScw: string) {
        await this.readyPromise;
        const projects = await this.#pool.query<ProjectRawType>(
            getProjectsByOwnerQuery,
            [ownerScw]
        );
        return projects.rows;
    }

    async getProjectByApiKey(
        projectApiKey: string,
        loadAllOnInit?: boolean
    ): Promise<Project> {
        await this.readyPromise;
        return new Project(
            { projectApiKey },
            this.#pool,
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
            this.#pool,
            this.#authToken,
            loadAllOnInit
        );
    }
}
