export const NONCE_EXPIRATION = 86400 * 365; // 1 year

export const createProjectsTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS projects ( \
    project_id VARCHAR ( 256 ) serial PRIMARY KEY, \
    api_key VARCHAR ( 256 )UNIQUE  NOT NULL, \
    created_at TIMESTAMP NOT NULL, \
    owner_scw VARCHAR ( 70 ) NOT NULL, \
    allowed_origins VARCHAR ( 256 ) ARRAY NOT NULL, \
); \
';

export const createGasTanksTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS gas_tanks ( \
    gas_tank_id VARCHAR ( 256 ) serial PRIMARY KEY, \
    api_key VARCHAR ( 256 ) NOT NULL, \
    projedt_id VARCHAR ( 256 ) NOT NULL, \
    created_at TIMESTAMP NOT NULL, \
    name VARCHAR ( 256 ) NOT NULL, \
    chain_id INT NOT NULL, \
    provider_url VARCHAR ( 256 ) NOT NULL, \
    FOREIGN KEY (projedt_id) \
      REFERENCES projects (project_id) \
); \
';

export const createGaslessLoginTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS gasless_login ( \
    gasless_login_id VARCHAR ( 256 ) serial PRIMARY KEY, \
    address VARCHAR ( 70 ) NOT NULL, \
    nonce VARCHAR ( 256 ) NOT NULL, \
    expiration INT NOT NULL ,\
    gas_tank_id VARCHAR (256) NOT NULL\
    FOREIGN KEY (gas_tank_id) \
      REFERENCES gas_tanks (gas_tank_id) \
); \
';

export const createContractsWhitelistTable =
    ' \
CREATE TABLE IF NOT EXISTS contracts_whitelist ( \
    contracts_whitelist_id VARCHAR ( 256 ) serial PRIMARY KEY, \
    address VARCHAR ( 70 ) NOT NULL, \
    gasTankID VARCHAR (256) NOT NULL\
    FOREIGN KEY (gas_tank_id) \
      REFERENCES gas_tanks (gas_tank_id) \
    );';

export const dropGaslessLoginTableQuery = 'DROP TABLE IF EXISTS gasless_login;';
export const dropContractsWhitelistTable =
    'DROP TABLE IF EXISTS contracts_whitelist;';
export const dropGasTanksTableQuery = 'DROP TABLE IF EXISTS gas_tanks;';
export const dropProjectsTableQuery = 'DROP TABLE IF EXISTS projects;';

export const createIndexForScwWhitelistTable =
    'CREATE INDEX contracts_whitelist_index ON contracts_whitelist USING HASH (address);';

export const createIndexForProjectsTable =
    'CREATE INDEX projects_index ON projects USING HASH (api_key);';

export const createIndexForGasTanksTable =
    'CREATE INDEX gas_tanks_index ON gas_tanks USING HASH (project_id);';

export const createIndexForGasLessLoginTable =
    'CREATE INDEX gasless_login_index ON gasless_login USING HASH (address);';
