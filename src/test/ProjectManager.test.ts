// import { PassThrough } from 'stream';

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';

import { GasTank } from '../lib/GasTank';
import Project from '../lib/Project';
import ProjectsManager from '../lib/ProjectsManager';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const projectParams = {
    name: 'testProject',
    ownerScw: '0x0000000000000000000000000000000000000000',
    allowedOrigins: ['http://localhost:3000']
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const projectApiKey = '3165ad4b-1c96-4bd9-8a11-59c3350e9a0f';

const gasTankProps = {
    name: 'testGasTank',
    chainId: 5,
    providerURL:
        'https://eth-goerli.g.alchemy.com/v2/c7FL3Wd0zxt_DtjeN1wqMWtCFVUTV_sP',
    whiteList: ['0x0000000000000000000000000000000000000000']
};

const constants: {
    wallet: ethers.Wallet;
    projectsManager: ProjectsManager;
    project?: Project;
} = {
    wallet: ethers.Wallet.createRandom(),
    projectsManager: new ProjectsManager('./testing.yml')
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
    test('project manager created successfully', async () => {
        expect(constants.projectsManager).toBeInstanceOf(ProjectsManager);
    });

    test('project manager has projects', async () => {
        const projects = await constants.projectsManager.getAllProjects();
        console.log(projects);
        console.log(typeof projects[0].created_at);
        expect(projects).toBeInstanceOf(Array);
    });
});
