export const NONCE_EXPIRATION = 86400 * 365; // 1 year

export const createProjectsTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS projects ( \
    project_id UUID PRIMARY KEY, \
    project_api_key UUID NOT NULL, \
    name VARCHAR ( 256 ) NOT NULL, \
    created_at TIMESTAMPTZ NOT NULL, \
    owner_scw VARCHAR ( 70 ) NOT NULL, \
    allowed_origins VARCHAR ( 256 ) ARRAY NOT NULL, \
    UNIQUE (owner_scw, name) \
); \
';

export const createGasTanksTableQuery =
    ' \
CREATE TABLE IF NOT EXISTS gas_tanks ( \
    gas_tank_id bigserial PRIMARY KEY, \
    api_key VARCHAR ( 256 ) NOT NULL, \
    project_id UUID NOT NULL, \
    created_at TIMESTAMPTZ NOT NULL, \
    chain_id BIGINT NOT NULL, \
    provider_url VARCHAR ( 256 ) NOT NULL, \
    funding_key BIGINT NOT NULL, \
    FOREIGN KEY (project_id) \
      REFERENCES projects (project_id) ON DELETE CASCADE, \
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
      REFERENCES gas_tanks (gas_tank_id) ON DELETE CASCADE, \
    UNIQUE (gas_tank_id, address) \
); \
';

export const createContractsWhitelistTable =
    ' \
CREATE TABLE IF NOT EXISTS contracts_whitelist ( \
    contracts_whitelist_id bigserial PRIMARY KEY, \
    address VARCHAR ( 70 ) NOT NULL, \
    gas_tank_id BIGINT NOT NULL, \
    FOREIGN KEY (gas_tank_id) \
      REFERENCES gas_tanks (gas_tank_id) ON DELETE CASCADE, \
    UNIQUE (gas_tank_id, address) \
); \
';

export const dropGaslessLoginTableQuery = 'DROP TABLE IF EXISTS gasless_login;';
export const dropContractsWhitelistTable =
    'DROP TABLE IF EXISTS contracts_whitelist;';
export const dropGasTanksTableQuery = 'DROP TABLE IF EXISTS gas_tanks;';
export const dropProjectsTableQuery = 'DROP TABLE IF EXISTS projects;';

// indices
export const createIndexForProjectsTableApiKey =
    'CREATE INDEX projects_index ON projects USING HASH (project_api_key);';
export const createIndexForProjectsTableOwner =
    'CREATE INDEX projects_index ON projects USING HASH (owner_scw);';

export const createIndexForGasTanksTable =
    'CREATE INDEX gas_tanks_index ON gas_tanks USING HASH (project_id);';

export const createIndexForContractsWhitelistTable =
    'CREATE INDEX contracts_whitelist_index ON contracts_whitelist USING HASH (address);';

export const createIndexForGasLessLoginTable =
    'CREATE INDEX gasless_login_index ON gasless_login USING HASH (address);';

export const indices = [
    createIndexForProjectsTableApiKey,
    createIndexForProjectsTableOwner,
    createIndexForGasTanksTable,
    createIndexForContractsWhitelistTable,
    createIndexForGasLessLoginTable
];

// create
export const addProjectQuery =
    'INSERT INTO projects (project_id, project_api_key, name, created_at, owner_scw, allowed_origins) VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4) RETURNING project_id';
export const addNativeProjectQuery =
    'INSERT INTO projects (project_id, project_api_key, name, created_at, owner_scw, allowed_origins) VALUES ($1, $2, $3, $4, $5, $6)';
export const addGasTankQuery =
    'INSERT INTO gas_tanks (api_key, project_id, created_at, chain_id, provider_url, funding_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING gas_tank_id';
export const addNativeGasTanksQuery =
    'INSERT INTO gas_tanks (api_key, project_id, created_at, chain_id, provider_url, funding_key) SELECT * FROM UNNEST ($1::VARCHAR[], $2::UUID[], $3::TIMESTAMPTZ[], $4::BIGINT[], $5::VARCHAR[], $6::BIGINT[])';
export const addMultiGasTankWhitelistQuery =
    'INSERT INTO contracts_whitelist (address, gas_tank_id) SELECT * FROM UNNEST ($1::VARCHAR[], $2::BIGINT[])';
export const addContractWhitelistQuery =
    'INSERT INTO contracts_whitelist (address, gas_tank_id) VALUES ($1, $2);';
export const addGaslessLoginQuery =
    'INSERT INTO gasless_login (address, nonce, expiration, gas_tank_id) VALUES ($1, $2, $3, $4)';

// read
export const getProjectsByOwnerQuery =
    'SELECT * FROM projects WHERE owner_scw = $1';
export const getGasTanksByProjectIdQuery =
    'SELECT gas_tank_id as "gasTankId", api_key as "apiKey", chain_id as "chainId", provider_url as "providerURL", created_at as "createdAt", funding_key as "fundingKey" FROM gas_tanks WHERE project_id = $1';
export const getGasTankByChainIdQuery =
    'SELECT gas_tank_id as "gasTankId", api_key as "apiKey", chain_id as "chainId", provider_url as "providerURL", created_at as "createdAt", funding_key as "fundingKey" FROM gas_tanks WHERE project_id = $1 AND chain_id = $2';

export const getGasTanksByProjectIdRaw =
    ' \
    SELECT gas_tank_id, project_id, api_key, gt.created_at, chain_id, provider_url, funding_key, ARRAY_AGG (address) whitelist \
    FROM projects \
    RIGHT JOIN gas_tanks gt USING(project_id) \
    LEFT JOIN contracts_whitelist USING(gas_tank_id) \
    WHERE project_id = $1 \
    GROUP BY gas_tank_id \
    ;';

// update
export const updateProjectNameAndAllowedOriginsQuery =
    'UPDATE projects SET name = $1, allowed_origins = $2 WHERE project_id = $3';
export const updateGasTankQuery =
    'UPDATE gas_tanks SET provider_url = $1 WHERE gas_tank_id = $2';

// delete
export const deleteProjectQuery =
    'DELETE FROM projects CASCADE WHERE project_id = $1';
export const deleteContractsWhitelistQuery =
    'DELETE FROM contracts_whitelist WHERE address = $1 AND gas_tank_id = $2 ;';
export const deleteNativeGasTanksQuery =
    'DELETE FROM gas_tanks WHERE project_id = $1';
