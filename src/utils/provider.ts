import { ZeroWalletProviderType } from '../types';

export const getTransactionReceipt = async (
    provider: ZeroWalletProviderType,
    transactionHash: string | undefined
) => {
    if (
        typeof transactionHash === 'undefined' ||
        transactionHash === undefined
    ) {
        return false;
    }

    await provider.waitForTransaction(transactionHash, 1);
    return await provider.getTransactionReceipt(transactionHash);
};
