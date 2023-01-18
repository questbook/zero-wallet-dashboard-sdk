/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseConfig, fileDoc } from '../types';
import { GasTankProps } from '../types';

function isGasTankNative(obj: any): obj is GasTankProps {
    let isTypeCorrect = true;
    if (typeof obj?.apiKey !== 'string') isTypeCorrect = false;
    if (typeof obj?.chainId !== 'number') isTypeCorrect = false;
    if (typeof obj?.providerURL !== 'string') isTypeCorrect = false;
    if (typeof obj?.fundingKey !== 'number') isTypeCorrect = false;
    if (isListOfStrings(!obj?.whiteList)) isTypeCorrect = false;
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

function isListOfStrings(obj: any): obj is string[] {
    let isTypeCorrect = false;
    if (Array.isArray(obj)) {
        isTypeCorrect = true;
        obj.forEach((item) => {
            if (typeof item !== 'string') {
                isTypeCorrect = false;
            }
        });
    }
    return isTypeCorrect;
}

function isNativeProjectType(obj: any): obj is fileDoc['project'] {
    let isTypeCorrect = true;
    if (typeof obj?.name !== 'string') isTypeCorrect = false;
    if (typeof obj?.ownerScw !== 'string') isTypeCorrect = false;
    if (!isListOfStrings(obj?.allowedOrigins)) isTypeCorrect = false;

    if (!isTypeCorrect) {
        throw new Error(
            'native project in yml file does not match the required structure'
        );
    }
    return true;
}

function isNativeGasTanksType(obj: any): obj is fileDoc['gasTanks'] {
    if (typeof obj !== 'object') {
        throw new Error(
            'gasTanks in yml file does not match the required structure'
        );
    }
    Object.values(obj).forEach((gasTank) => {
        isGasTankNative(gasTank);
    });
    return true;
}

export function isFileDoc(obj: any): obj is fileDoc {
    if (obj?.authToken === undefined || obj?.databaseConfig === undefined) {
        throw new Error('yml file does not match the required structure');
    }
    try {
        console.log(obj.project);
        isDatabaseConfig(obj.databaseConfig);
        isAuthToken(obj.authToken);
        isNativeProjectType(obj.project);
        isNativeGasTanksType(obj.gasTanks);
    } catch (e) {
        throw new Error(e as string);
    }
    return true;
}
