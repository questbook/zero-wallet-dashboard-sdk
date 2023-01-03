import { PassThrough } from 'stream';

import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';

import { ZeroWallet } from '../lib/ZeroWallet';

const constants = {
    wallet: ethers.Wallet.createRandom(),
    zeroWallet: new ZeroWallet('./testing.yml')
};

beforeEach(async () => {
    try {
        await constants.zeroWallet
            .getGasTank('testGasTankName')
            .deleteUser(constants.wallet.address);
    } catch (e) {
        PassThrough;
    }
});

afterAll(() => {
    constants.zeroWallet
        .getGasTank('testGasTankName')
        .authorizer.endConnection();
});

describe('testing functions working with authorizer', () => {
    test('check addAuthorizedUser and doesUserExist functions', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            false
        );

        await gasTank.addAuthorizedUser(constants.wallet.address);
        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            true
        );
    });
    test('check deleteUser function', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            false
        );
        gasTank.addAuthorizedUser(constants.wallet.address);
        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            true
        );
        await gasTank.deleteUser(constants.wallet.address);
        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            false
        );
    });
    test('check isInWhiteList function', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        const contractAddress = 'contract-address';
        const contractAddress2 = 'contract-address2';
        expect(await gasTank.authorizer.isInWhiteList(contractAddress2)).toBe(
            false
        );
        expect(await gasTank.authorizer.isInWhiteList(contractAddress)).toBe(
            true
        );
    });

    test('check getNonce function', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);
        const nonce = await gasTank.getNonce(constants.wallet.address);
        await gasTank.deleteUser(constants.wallet.address);
        expect(typeof nonce).toBe('string');
        if (typeof nonce !== 'string') {
            return;
        }
        expect(nonce.length).toBe(100);
        const characters =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        expect(nonce).toMatch(new RegExp(`[${characters}]+`));
    });

    test('check isUserAuthorized function returns true', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);
        const nonce = await gasTank.getNonce(constants.wallet.address);

        expect(nonce).not.toBe(false);
        if (typeof nonce !== 'string') {
            return;
        }

        const signature = await constants.wallet.signMessage(nonce);
        const nonceSig = ethers.utils.splitSignature(signature);
        const nonceHash = ethers.utils.hashMessage(nonce);
        const signedNonce = {
            r: nonceSig.r,
            s: nonceSig.s,
            v: nonceSig.v,
            transactionHash: nonceHash
        };

        expect(
            await gasTank.authorizer.isUserAuthorized(
                signedNonce,
                nonce,
                constants.wallet.address
            )
        ).toBe(true);

        await gasTank.deleteUser(constants.wallet.address);
    });

    test('check isUserAuthorized function returns false', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        const nonce = await gasTank.getNonce(constants.wallet.address);

        expect(nonce).toBe(false);
        if (typeof nonce !== 'string') {
            return;
        }

        const signature = await constants.wallet.signMessage(nonce);
        const nonceSig = ethers.utils.splitSignature(signature);
        const nonceHash = ethers.utils.hashMessage(nonce);
        const signedNonce = {
            r: nonceSig.r,
            s: nonceSig.s,
            v: nonceSig.v,
            transactionHash: nonceHash
        };

        expect(
            await gasTank.authorizer.isUserAuthorized(
                signedNonce,
                nonce,
                constants.wallet.address
            )
        ).toBe(false);

        await gasTank.deleteUser(constants.wallet.address);
    });
});

describe('testing functions working with relayer', () => {
    test('check that buildTransaction function throws error : "User is not registered!"', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        expect(await gasTank.doesUserExist(constants.wallet.address)).toBe(
            false
        );
        const signedNonce = {
            r: '2322',
            s: '0x00',
            v: 0,
            transactionHash: '0x00'
        };
        const webHookAttributes = {
            nonce: 'nonce',
            signedNonce,
            to: 'to',
            chainId: 5
        };
        const params = {
            populatedTx: 'populatedTx',
            targetContractAddress: 'targetContractAddress',
            zeroWalletAddress: constants.wallet.address,
            webHookAttributes
        };
        await expect(gasTank.buildTransaction(params)).rejects.toThrow(
            'User is not registered!'
        );
    });
    test('check that buildTransaction function throws error : "SCW is not deployed" ', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);
        const nonce = await gasTank.getNonce(constants.wallet.address);
        expect(nonce).not.toBe(false);
        if (typeof nonce !== 'string') {
            return;
        }

        const signature = await constants.wallet.signMessage(nonce);
        const nonceSig = ethers.utils.splitSignature(signature);
        const nonceHash = ethers.utils.hashMessage(nonce);
        const signedNonce = {
            r: nonceSig.r,
            s: nonceSig.s,
            v: nonceSig.v,
            transactionHash: nonceHash
        };

        const webHookAttributes = {
            nonce,
            signedNonce,
            to: 'to',
            chainId: 5
        };
        const params = {
            populatedTx: 'populatedTx',
            targetContractAddress: 'targetContractAddress',
            zeroWalletAddress: constants.wallet.address,
            webHookAttributes
        };
        await expect(gasTank.buildTransaction(params)).rejects.toThrow(
            `SCW is not deployed for ${constants.wallet.address}`
        );
    });
    test('check that doesProxyWalletExist function returns false" ', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);

        expect(
            (await gasTank.doesProxyWalletExist(constants.wallet.address))
                .doesWalletExist
        ).toBe(false);
        await gasTank.deleteUser(constants.wallet.address);
    });

    test('testing deployProxyWallet & doesProxyWalletExist functions" ', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);
        const nonce = await gasTank.getNonce(constants.wallet.address);
        expect(nonce).not.toBe(false);
        if (typeof nonce !== 'string') {
            return;
        }

        const signature = await constants.wallet.signMessage(nonce);
        const nonceSig = ethers.utils.splitSignature(signature);
        const nonceHash = ethers.utils.hashMessage(nonce);
        const signedNonce = {
            r: nonceSig.r,
            s: nonceSig.s,
            v: nonceSig.v,
            transactionHash: nonceHash
        };
        const webHookAttributes = {
            nonce: nonce,
            signedNonce: signedNonce
        };

        const params = {
            zeroWalletAddress: constants.wallet.address,
            webHookAttributes: webHookAttributes
        };
        const scwAddress = await gasTank.deployProxyWallet(params);

        gasTank.deleteUser(constants.wallet.address);

        expect(
            await gasTank.doesProxyWalletExist(constants.wallet.address)
        ).toEqual({ doesWalletExist: true, walletAddress: scwAddress });
    });
    test('testing isInWhiteList" ', async () => {
        const gasTank = constants.zeroWallet.getGasTank('testGasTankName');

        await gasTank.addAuthorizedUser(constants.wallet.address);
        const nonce = await gasTank.getNonce(constants.wallet.address);
        expect(nonce).not.toBe(false);
        if (typeof nonce !== 'string') {
            return;
        }

        const signature = await constants.wallet.signMessage(nonce);
        const nonceSig = ethers.utils.splitSignature(signature);
        const nonceHash = ethers.utils.hashMessage(nonce);
        const signedNonce = {
            r: nonceSig.r,
            s: nonceSig.s,
            v: nonceSig.v,
            transactionHash: nonceHash
        };
        const webHookAttributes = {
            nonce: nonce,
            signedNonce: signedNonce
        };

        const params = {
            zeroWalletAddress: constants.wallet.address,
            webHookAttributes: webHookAttributes
        };
        const scwAddress = await gasTank.deployProxyWallet(params);

        gasTank.deleteUser(constants.wallet.address);

        expect(await gasTank.authorizer.isInWhiteList(scwAddress)).toBe(true);
    });
});
