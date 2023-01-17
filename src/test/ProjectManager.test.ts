// import { PassThrough } from 'stream';

import { afterAll, describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';

import { GasTank } from '../lib/GasTank';
import Project from '../lib/Project';
import ProjectsManager from '../lib/ProjectsManager';

const mockProject1 = {
    name: 'testProject1',
    ownerScw: '0x0000000000000000000000000000000000000000',
    allowedOrigins: ['http://localhost:3000']
};

const mockProject2 = {
    name: 'testProject2',
    ownerScw: '0x0000000000000000000000000000000000000001',
    allowedOrigins: ['http://localhost:3000']
};

const gasTankProps = {
    chainId: 5,
    providerURL:
        'https://eth-goerli.g.alchemy.com/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

const gasTankWhiteList = ['0x123', '0x456'];
const createdGasTanks: GasTank[] = [];

const constants: {
    wallet: ethers.Wallet;
    projectsManager: ProjectsManager;
    project?: Project;
} = {
    wallet: ethers.Wallet.createRandom(),
    projectsManager: new ProjectsManager('./testing.yml', true)
};

afterAll(async () => {
    const gasTanksReady = createdGasTanks.map(async (gasTank) => {
        await gasTank.readyPromise;
    });
    // Biconomy throws an error if the gas tank is empty.
    await Promise.allSettled(gasTanksReady);

    await constants.projectsManager.endConnection();
});

describe('ProjectManager', () => {
    test('project manager created successfully with zero projects', async () => {
        expect(constants.projectsManager).toBeInstanceOf(ProjectsManager);
        const count = await constants.projectsManager.getProjectsCount();
        expect(count).toBe(0);
    });

    test('project manager adds then removes a project', async () => {
        const { projectId } = await constants.projectsManager.addProject(
            mockProject1.name,
            mockProject1.ownerScw,
            mockProject1.allowedOrigins
        );
        const project = await constants.projectsManager.getProjectById(
            projectId!
        );
        await project.readyPromise;

        const count = await constants.projectsManager.getProjectsCount();
        expect(count).toBe(1);
        expect(project).toBeInstanceOf(Project);
        expect(project).toEqual(
            expect.objectContaining({
                name: mockProject1.name,
                owner: mockProject1.ownerScw,
                allowedOrigins: mockProject1.allowedOrigins,
                projectId
            })
        );

        await constants.projectsManager.removeProject(projectId!);
        const countAgain = await constants.projectsManager.getProjectsCount();
        expect(countAgain).toBe(0);
    });

    test('project has a gas tank', async () => {
        const project = await constants.projectsManager.addProject(
            mockProject2.name,
            mockProject2.ownerScw,
            mockProject2.allowedOrigins
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);

        // By chain id
        const gasTankByChainId = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId
        );
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        gasTankByChainId.readyPromise.catch(() => {});
        createdGasTanks.push(gasTankByChainId);
        expect(gasTankByChainId).toBeInstanceOf(GasTank);

        // getting all gas tanks raw
        const gasTanks = await project.getGasTanksRaw();

        expect(gasTanks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    project_id: project.projectId!,
                    chain_id: gasTankProps.chainId.toString(),
                    provider_url: gasTankProps.providerURL,
                    whitelist: expect.arrayContaining(gasTankWhiteList)
                })
            ])
        );
    });

    test('project tries to add two gas tanks on the same network', async () => {
        const project = await constants.projectsManager.addProject(
            mockProject2.name,
            mockProject2.ownerScw,
            mockProject2.allowedOrigins
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);
        const gasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId
        );
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        gasTank.readyPromise.catch(() => {});
        createdGasTanks.push(gasTank);

        try {
            await project.addGasTank(gasTankProps, gasTankWhiteList);
            throw new Error(
                'Should not be able to add two gas tanks on the same network'
            );
        } catch (e: unknown) {
            let message;
            if (typeof e === 'string') {
                message = e.toUpperCase(); // works, `e` narrowed to string
            } else if (e instanceof Error) {
                message = e.message; // works, `e` narrowed to Error
            }
            expect(message).toBe('gas tank chain id should be unique');
        }
    });
});
