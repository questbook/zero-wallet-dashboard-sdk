// import { PassThrough } from 'stream';

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
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
    name: 'testGasTank1',
    chainId: 5,
    providerURL:
        'https://eth-goerli.g.alchemy.com/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    fundingKey: 0
};

const gasTankWhiteList = ['0x123', '0x456'];

const constants: {
    wallet: ethers.Wallet;
    projectsManager: ProjectsManager;
    project?: Project;
} = {
    wallet: ethers.Wallet.createRandom(),
    projectsManager: new ProjectsManager('./testing.yml', true)
};

beforeAll(async () => {
    // try {
    // constants.project = await constants.projectsManager.addProject(
    //     projectParams.name,
    //     projectParams.ownerScw,
    //     projectParams.allowedOrigins
    // );
    // await constants.project.readyPromise;
    // await constants.project.addGasTank(gasTankProps);
    // constants.project = await constants.projectsManager.getProject(
    //     projectApiKey
    // );
    // } catch (e) {
    //     PassThrough;
    // }
    await constants.projectsManager.readyPromise;
});

afterAll(async () => {
    // await constants.projectsManager.clearDatabase();
    await constants.projectsManager.endConnection();
    // await constants.project?.getGasTank(gasTankProps.name);
});

describe('ProjectManager', () => {
    test('project manager created successfully with zero projects', async () => {
        expect(constants.projectsManager).toBeInstanceOf(ProjectsManager);
        const projects = await constants.projectsManager.getAllProjectsRaw();
        expect(projects.length).toBe(0);
    });

    test('project manager adds then removes a project', async () => {
        const { apiKey } = await constants.projectsManager.addProject(
            mockProject1.name,
            mockProject1.ownerScw,
            mockProject1.allowedOrigins
        );
        const projects = await constants.projectsManager.getAllProjectsRaw();
        const project = await constants.projectsManager.getProject(apiKey);
        await project.readyPromise;

        expect(projects.length).toBe(1);
        expect(project).toBeInstanceOf(Project);
        expect(project).toEqual(
            expect.objectContaining({
                name: mockProject1.name,
                owner: mockProject1.ownerScw,
                allowedOrigins: mockProject1.allowedOrigins,
                apiKey
            })
        );

        await constants.projectsManager.removeProject(apiKey);
        const projectsEmpty =
            await constants.projectsManager.getAllProjectsRaw();
        expect(projectsEmpty.length).toBe(0);
    });

    test('project has a gas tank', async () => {
        const project = await constants.projectsManager.addProject(
            mockProject2.name,
            mockProject2.ownerScw,
            mockProject2.allowedOrigins
        );
        await project.readyPromise;

        await project.addGasTank(gasTankProps, gasTankWhiteList);

        // By chain id
        const gasTankByChainId = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId
        );
        expect(gasTankByChainId).toBeInstanceOf(GasTank);

        // By name
        const gasTankByName = await project.loadAndGetGasTankByName(
            gasTankProps.name
        );
        expect(gasTankByName).toBeInstanceOf(GasTank);

        // Biconomy throws an error if the gas tank is empty.
        try {
            await gasTankByChainId.readyPromise;
            // eslint-disable-next-line no-empty
        } catch {}

        try {
            await gasTankByName.readyPromise;
            // eslint-disable-next-line no-empty
        } catch {}
    });
});
