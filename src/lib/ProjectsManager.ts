import { readFileSync } from 'fs';

import { load } from 'js-yaml';
import { Pool } from 'pg';

import {
    addProjectQuery,
    createContractsWhitelistTable,
    createGaslessLoginTableQuery,
    createGasTanksTableQuery,
    createIndexForContractsWhitelistTable,
    createIndexForGasLessLoginTable,
    createIndexForGasTanksTable,
    createProjectsTableQuery,
    deleteProjectQuery,
    dropContractsWhitelistTable,
    dropGaslessLoginTableQuery,
    dropGasTanksTableQuery,
    dropProjectsTableQuery,
    getProjectsByOwnerQuery
} from '../constants/database';
import { fileDoc, ProjectRawType } from '../types';
import { isFileDoc } from '../utils/typeChecker';

import Project from './Project';

export default class ProjectsManager {
    #pool: Pool;
    #authToken: string;
    readyPromise: Promise<void>;
    isTesting: boolean;

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
        try {
            await this.#pool.query(createIndexForGasTanksTable);
        } catch (err) {
            console.log('error creating index in gas_tanks table');
        }
        try {
            await this.#pool.query(createIndexForGasLessLoginTable);
        } catch (err) {
            console.log('error creating index in gasless_login table');
        }
        try {
            await this.#pool.query(createIndexForContractsWhitelistTable);
        } catch (err) {
            console.log('error creating index in whitelist table');
        }
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
