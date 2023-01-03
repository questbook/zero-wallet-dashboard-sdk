const Pool = require('pg').Pool;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'test',
    password: 'postgres',
    port: 5432
});
pool.query("CREATE TABLE IF NOT EXISTS gasless_login (address VARCHAR(42) PRIMARY KEY, nonce VARCHAR(100), expiration BIGINT, gas_tank_id VARCHAR(42));");
