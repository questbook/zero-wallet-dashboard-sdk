import { Pool } from 'pg';

import {
    dropContractsWhitelistTable,
    dropGaslessLoginTableQuery
} from '../constants/database';
import { DatabaseConfig } from '../types';

export async function clearDB(databaseConfig: DatabaseConfig) {
    const pool = new Pool(databaseConfig);
    await pool.query(dropGaslessLoginTableQuery);
    await pool.query(dropContractsWhitelistTable);
}
