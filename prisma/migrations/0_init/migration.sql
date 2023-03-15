-- CreateTable
CREATE TABLE "contracts_whitelist" (
    "contracts_whitelist_id" BIGSERIAL NOT NULL,
    "address" VARCHAR(70) NOT NULL,
    "gas_tank_id" BIGINT NOT NULL,

    CONSTRAINT "contracts_whitelist_pkey" PRIMARY KEY ("contracts_whitelist_id")
);

-- CreateTable
CREATE TABLE "gas_tanks" (
    "gas_tank_id" BIGSERIAL NOT NULL,
    "api_key" VARCHAR(256) NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "chain_id" BIGINT NOT NULL,
    "provider_url" VARCHAR(256) NOT NULL,
    "funding_key" BIGINT NOT NULL,

    CONSTRAINT "gas_tanks_pkey" PRIMARY KEY ("gas_tank_id")
);

-- CreateTable
CREATE TABLE "gasless_login" (
    "gasless_login_id" BIGSERIAL NOT NULL,
    "address" VARCHAR(70) NOT NULL,
    "nonce" VARCHAR(256) NOT NULL,
    "expiration" BIGINT NOT NULL,
    "gas_tank_id" BIGINT NOT NULL,

    CONSTRAINT "gasless_login_pkey" PRIMARY KEY ("gasless_login_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "project_id" UUID NOT NULL,
    "project_api_key" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "owner_scw" VARCHAR(70) NOT NULL,
    "allowed_origins" VARCHAR(256)[],

    CONSTRAINT "projects_pkey" PRIMARY KEY ("project_id")
);

-- CreateIndex
CREATE INDEX "contracts_whitelist_index" ON "contracts_whitelist" USING HASH ("address");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_whitelist_gas_tank_id_address_key" ON "contracts_whitelist"("gas_tank_id", "address");

-- CreateIndex
CREATE INDEX "gas_tanks_index" ON "gas_tanks" USING HASH ("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "gas_tanks_project_id_chain_id_key" ON "gas_tanks"("project_id", "chain_id");

-- CreateIndex
CREATE INDEX "gasless_login_index" ON "gasless_login" USING HASH ("address");

-- CreateIndex
CREATE UNIQUE INDEX "gasless_login_gas_tank_id_address_key" ON "gasless_login"("gas_tank_id", "address");

-- CreateIndex
CREATE INDEX "projects_index" ON "projects" USING HASH ("project_api_key");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_api_key_key" ON "projects"("project_api_key");

-- CreateIndex
CREATE UNIQUE INDEX "projects_owner_scw_name_key" ON "projects"("owner_scw", "name");

-- AddForeignKey
ALTER TABLE "contracts_whitelist" ADD CONSTRAINT "contracts_whitelist_gas_tank_id_fkey" FOREIGN KEY ("gas_tank_id") REFERENCES "gas_tanks"("gas_tank_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gas_tanks" ADD CONSTRAINT "gas_tanks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gasless_login" ADD CONSTRAINT "gasless_login_gas_tank_id_fkey" FOREIGN KEY ("gas_tank_id") REFERENCES "gas_tanks"("gas_tank_id") ON DELETE CASCADE ON UPDATE NO ACTION;

