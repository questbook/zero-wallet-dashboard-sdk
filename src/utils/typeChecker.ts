/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseConfig, fileDoc } from '../types';
import { GasTankProps } from '../types';

export function isGasTankProps(obj: any): obj is GasTankProps {
    let isTypeCorrect = true;
    if (typeof obj?.name !== 'string') isTypeCorrect = false;
    if (typeof obj?.apiKey !== 'string') isTypeCorrect = false;
    if (typeof obj?.name !== 'string') isTypeCorrect = false;
    if (typeof obj?.chainId !== 'string' && typeof obj?.chainId !== 'number')
        isTypeCorrect = false;
    if (typeof obj?.providerURL !== 'string') isTypeCorrect = false;
    if (!obj?.whiteList?.length) isTypeCorrect = false;
    if (!isTypeCorrect) {
        throw new Error(
            'gasTank in yml file does not match the required structure'
        );
    }
    return true;
}

function isAuthToken(obj: any): obj is string {
    if (typeof obj !== 'string') {
        throw new Error('authToken in yml file is not a string');
    }
    return true;
}

function isDatabaseConfig(obj: any): obj is DatabaseConfig {
    let isTypeCorrect = true;
    if (typeof obj?.user !== 'string') isTypeCorrect = false;
    if (typeof obj?.host !== 'string') isTypeCorrect = false;
    if (typeof obj?.database !== 'string') isTypeCorrect = false;
    if (typeof obj?.password !== 'string') isTypeCorrect = false;
    if (typeof obj?.port !== 'number' && typeof obj?.port !== 'string')
        isTypeCorrect = false;
    if (!isTypeCorrect) {
        throw new Error(
            'databaseConfig in yml file does not match the required structure'
        );
    }
    return true;
}

export function isFileDoc(obj: any): obj is fileDoc {
    if (obj?.authToken === undefined || obj?.databaseConfig === undefined) {
        throw new Error('yml file does not match the required structure');
    }
    try {
        isDatabaseConfig(obj.databaseConfig);
        isAuthToken(obj.authToken);
    } catch (e) {
        throw new Error(e as string);
    }
    return true;
}
