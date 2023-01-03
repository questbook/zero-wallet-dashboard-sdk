import { SupportedChainId } from '../../constants/chains';
import {
    SendGaslessTransactionParams,
    SendGaslessTransactionType
} from '../../types';

export interface BaseRelayer {
    name: string;
    chainId: SupportedChainId;
    initRelayer(params: any): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    sendGaslessTransaction(
        params: SendGaslessTransactionParams
    ): Promise<SendGaslessTransactionType>;
}
