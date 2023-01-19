import { ethers } from 'ethers';

import { SupportedChainId } from '../constants/chains';

import {
    BiconomyBuildTransactionParams,
    BiconomySendGaslessTransactionParams,
    DeployWebHookAttributesType,
    InitBiconomyRelayerProps,
    InitBiconomyRelayerType
} from './biconomy';

export type ZeroWalletProviderType = ethers.providers.JsonRpcProvider;

export type ZeroWalletProvidersType = {
    [key in SupportedChainId]: ZeroWalletProviderType;
};

export type GasTankProps = {
    gasTankId: string;
    apiKey: string;
    createdAt: string;
    chainId: SupportedChainId;
    providerURL: string;
    fundingKey: number;
};

export type GasTanksType = Array<GasTankProps>;

export type fileDoc = {
    databaseConfig: DatabaseConfig;
    authToken: string;
    project: NativeProjectType;
    gasTanks: { [key: string]: NativeGasTankType };
};

export type SendGaslessTransactionParams = BiconomySendGaslessTransactionParams; // @TODO-update

export type SendGaslessTransactionType = string; // @TODO-update

export type InitRelayerProps = InitBiconomyRelayerProps; // @TODO-update

export type InitRelayerType = InitBiconomyRelayerType; // @TODO-update

export type BuildTransactionParams = BiconomyBuildTransactionParams;

export type deployProxyWalletParams = {
    zeroWalletAddress: string;
    webHookAttributes: DeployWebHookAttributesType;
};

export type DatabaseConfig = {
    user: string;
    host: string;
    database: string;
    password: string;
    port: number;
};

export type SignedMessage = {
    transactionHash: string;
    r: string;
    s: string;
    v: number;
};

export type NativeProjectType = {
    name: string;
    ownerScw: string;
    allowedOrigins: string[];
    apiKey: string;
    projectId: string;
};

export type NativeGasTankType = {
    apiKey: string;
    chainId: number;
    providerURL: string;
    fundingKey: number;
    whitelist: string;
};

export type ProjectRawType = {
    project_id: string;
    project_api_key: string;
    name: string;
    created_at: string;
    owner_scw: string;
    allowed_origins: string[];
};

export type GasTankRawType = {
    gas_tank_id: string;
    project_id: string;
    created_at: string;
    chain_id: string;
    provider_url: string;
    funding_key: string;
    whitelist: string[];
    balance: string;
};

export type NewGasTankParams = {
    chainId: SupportedChainId;
    providerURL: string;
};
