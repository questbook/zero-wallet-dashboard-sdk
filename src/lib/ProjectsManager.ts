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
    dropProjectsTableQuery
} from '../constants/database';
import { fileDoc } from '../types';
import { isFileDoc } from '../utils/typeChecker';

import Project from './Project';

export default class ProjectsManager {
    #pool: Pool;
    #authToken: string;
    readyPromise: Promise<void>;

    constructor(path: string) {
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
        this.#authToken = doc.authToken;
        const parsedDataBaseConfig = {
            ...doc.databaseConfig,
            port: +doc.databaseConfig.port
        };
        this.#pool = new Pool(parsedDataBaseConfig);
        this.readyPromise = this.getDatabaseReadyWithIndex();
    }

    async clearDatabase() {
        try {
            await this.#pool.query(dropGaslessLoginTableQuery);
            await this.#pool.query(dropContractsWhitelistTable);
            await this.#pool.query(dropGasTanksTableQuery);
            await this.#pool.query(dropProjectsTableQuery);
        } catch {
            console.log('table does not exist');
        }
    }

    async createTables() {
        try {
            await this.#pool.query(createProjectsTableQuery);
            await this.#pool.query(createGasTanksTableQuery);
            await this.#pool.query(createGaslessLoginTableQuery);
            await this.#pool.query(createContractsWhitelistTable);
        } catch (err) {
            throw new Error(err as string);
        }
    }

    async createIndices() {
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
        // @todo: the next line to be removed after testing
        // await this.clearDatabase();

        await this.createTables();
        await this.createIndices();
    }

    async addProject(
        name: string,
        ownerScw: string,
        allowedOrigins: Array<string>
    ) {
        await this.readyPromise;
        const createAt = new Date();
        let apiKey;
        try {
            apiKey = await this.#pool.query(addProjectQuery, [
                name,
                createAt,
                ownerScw,
                allowedOrigins
            ]);
        } catch (err) {
            console.log(err);
            throw new Error(err as string);
        }
        console.log(apiKey);
        return new Project(
            apiKey.rows[0].project_id,
            this.#pool,
            this.#authToken
        );
    }

    async removeProject(apiKey: string) {
        await this.readyPromise;
        try {
            await this.#pool.query(deleteProjectQuery, [apiKey]);
        } catch (err) {
            console.log(err);
            throw new Error(err as string);
        }
    }

    async getAllProjects() {
        await this.readyPromise;
        const projects = await this.#pool.query('SELECT * FROM projects;');
        return projects.rows;
    }

    async getProject(apiKey: string): Promise<Project> {
        await this.readyPromise;
        return new Project(apiKey, this.#pool, this.#authToken);
    }
}
