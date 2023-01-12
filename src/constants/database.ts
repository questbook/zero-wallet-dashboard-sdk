export const NONCE_EXPIRATION = 86400 * 365; // 1 year

export const createProjectsTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS projects ( \
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), \
    name VARCHAR ( 256 ) NOT NULL, \
    created_at TIMESTAMPTZ NOT NULL, \
    owner_scw VARCHAR ( 70 ) NOT NULL, \
    allowed_origins VARCHAR ( 256 ) ARRAY NOT NULL \
); \
';

export const createGasTanksTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS gas_tanks ( \
    gas_tank_id bigserial PRIMARY KEY, \
    api_key VARCHAR ( 256 ) NOT NULL, \
    project_id UUID, \
    created_at TIMESTAMPTZ NOT NULL, \
    name VARCHAR ( 256 ) NOT NULL, \
    chain_id BIGINT NOT NULL, \
    provider_url VARCHAR ( 256 ) NOT NULL, \
    funding_key BIGINT NOT NULL, \
    FOREIGN KEY (project_id) \
      REFERENCES projects (project_id), \
    UNIQUE (project_id, name), \
    UNIQUE (project_id, chain_id) \
); \
';

export const createGaslessLoginTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS gasless_login ( \
    gasless_login_id bigserial PRIMARY KEY, \
    address VARCHAR ( 70 ) NOT NULL, \
    nonce VARCHAR ( 256 ) NOT NULL, \
    expiration BIGINT NOT NULL, \
    gas_tank_id BIGINT NOT NULL, \
    FOREIGN KEY (gas_tank_id) \
      REFERENCES gas_tanks (gas_tank_id) \
); \
';

export const createContractsWhitelistTable =
    ' \
CREATE TABLE IF NOT EXISTS contracts_whitelist ( \
    contracts_whitelist_id bigserial PRIMARY KEY, \
    address VARCHAR ( 70 ) NOT NULL, \
    gas_tank_id BIGINT NOT NULL, \
    FOREIGN KEY (gas_tank_id) \
      REFERENCES gas_tanks (gas_tank_id), \
    UNIQUE (gas_tank_id, address) \
); \
';

export const dropGaslessLoginTableQuery = 'DROP TABLE IF EXISTS gasless_login;';
export const dropContractsWhitelistTable =
    'DROP TABLE IF EXISTS contracts_whitelist;';
export const dropGasTanksTableQuery = 'DROP TABLE IF EXISTS gas_tanks;';
export const dropProjectsTableQuery = 'DROP TABLE IF EXISTS projects;';

export const createIndexForGasTanksTable =
    'CREATE INDEX gas_tanks_index ON gas_tanks USING HASH (project_id);';

export const createIndexForContractsWhitelistTable =
    'CREATE INDEX contracts_whitelist_index ON contracts_whitelist USING HASH (address);';

export const createIndexForGasLessLoginTable =
    'CREATE INDEX gasless_login_index ON gasless_login USING HASH (address);';

// create
export const addProjectQuery =
    'INSERT INTO projects (name, created_at, owner_scw, allowed_origins) VALUES ($1, $2, $3, $4) RETURNING project_id';
export const addGasTankQuery =
    'INSERT INTO gas_tanks (api_key, project_id, created_at, name, chain_id, provider_url, funding_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING gas_tank_id';
export const addMultiGasTankWhitelistQuery =
    'INSERT INTO contracts_whitelist (address, gas_tank_id) SELECT * FROM UNNEST ($1::VARCHAR[], $2::BIGINT[])';

// read
export const getGasTanksByProjectIdQuery =
    'SELECT name, api_key as "apiKey", chain_id as "chainId", provider_url as "providerURL", created_at as "createdAt", funding_key as "fundingKey" FROM gas_tanks WHERE project_id = $1';
export const getGasTankByChainIdQuery =
    'SELECT name, api_key as "apiKey", chain_id as "chainId", provider_url as "providerURL", created_at as "createdAt", funding_key as "fundingKey" FROM gas_tanks WHERE project_id = $1 AND chain_id = $2';
export const getGasTankByNameQuery =
    'SELECT name, api_key as "apiKey", chain_id as "chainId", provider_url as "providerURL", created_at as "createdAt", funding_key as "fundingKey" FROM gas_tanks WHERE project_id = $1 AND name = $2';

// delete
export const deleteProjectQuery =
    'DELETE FROM projects CASCADE WHERE project_id = $1';
