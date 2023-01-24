// import { PassThrough } from 'stream';

import { afterAll, describe, expect, test } from '@jest/globals';
import { ethers } from 'ethers';

import { GasTank } from '../lib/GasTank';
import Project from '../lib/Project';
import ProjectsManager from '../lib/ProjectsManager';

const mockProjects = [
    {
        name: 'testProject1',
        ownerScw: '0x0000000000000000000000000000000000000000',
        allowedOrigins: ['http://localhost:3001']
    },
    {
        name: 'testProject2',
        ownerScw: '0x0000000000000000000000000000000000000001',
        allowedOrigins: ['http://localhost:3002']
    },
    {
        name: 'testProject3',
        ownerScw: '0x0000000000000000000000000000000000000002',
        allowedOrigins: ['http://localhost:3003']
    },
    {
        name: 'testProject4',
        ownerScw: '0x0000000000000000000000000000000000000004',
        allowedOrigins: ['http://localhost:3004']
    },
    {
        name: 'testProject5',
        ownerScw: '0x0000000000000000000000000000000000000005',
        allowedOrigins: ['http://localhost:3005']
    },
    {
        name: 'testProject6',
        ownerScw: '0x0000000000000000000000000000000000000006',
        allowedOrigins: ['http://localhost:3006']
    }
];

const gasTankProps = {
    chainId: 5,
    providerURL:
        'https://eth-goerli.g.alchemy.com/v2/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

const gasTankWhiteList = ['0x123', '0x456'];
const createdEntities: (GasTank | Project)[] = [];

const constants: {
    wallet: ethers.Wallet;
    projectsManager: ProjectsManager;
    project?: Project;
} = {
    wallet: ethers.Wallet.createRandom(),
    projectsManager: new ProjectsManager('./testing.yml', true)
};

afterAll(async () => {
    const entitiesReady = createdEntities.map(async (entity) => {
        await entity.readyPromise;
    });
    // Biconomy throws an error if the gas tank is empty.
    await Promise.allSettled(entitiesReady);

    await constants.projectsManager.endConnection();
});

describe('ProjectManager', () => {
    test('project manager created successfully with only native project', async () => {
        expect(constants.projectsManager).toBeInstanceOf(ProjectsManager);
        const count = await constants.projectsManager.getProjectsCount();
        expect(count).toBe(1);
    });

    test('native project exists with filled gas tank', async () => {
        const { projectId, name, allowedOrigins, ownerScw, apiKey } =
            constants.projectsManager.nativeProject;

        const project = await constants.projectsManager.getProjectById(
            projectId
        );
        await project.readyPromise;
        expect(project).toBeInstanceOf(Project);
        expect(project).toEqual(
            expect.objectContaining({
                name,
                owner: ownerScw,
                allowedOrigins,
                projectId,
                apiKey
            })
        );
    });

    test('native project has a gas tank', async () => {
        const { projectId } = constants.projectsManager.nativeProject;
        const { chainId, providerURL, fundingKey } =
            constants.projectsManager.nativeGasTanks['test'];
        const project = await constants.projectsManager.getProjectById(
            projectId
        );
        await project.readyPromise;
        const gasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(gasTank);
        expect(gasTank).toBeInstanceOf(GasTank);
        expect(gasTank).toEqual(
            expect.objectContaining({
                chainId: chainId.toString(),
                providerURL,
                fundingKey
            })
        );
    });

    test('native gas tank has a positive balance', async () => {
        const { projectId } = constants.projectsManager.nativeProject;
        const project = await constants.projectsManager.getProjectById(
            projectId
        );
        const { balance } = (await project.getGasTanksRaw())[0];

        expect(parseFloat(balance)).toBeGreaterThan(0);
    });

    test('project manager adds then removes a project', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[0];
        const { projectId } = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );
        const project = await constants.projectsManager.getProjectById(
            projectId!
        );
        await project.readyPromise;

        expect(project).toBeInstanceOf(Project);
        expect(project).toEqual(
            expect.objectContaining({
                name: name,
                owner: ownerScw,
                allowedOrigins: allowedOrigins,
                projectId
            })
        );

        await constants.projectsManager.removeProject(projectId!);

        try {
            const project = await constants.projectsManager.getProjectById(
                projectId!
            );
            await project.readyPromise;
            throw new Error('Project should not exist');
            // eslint-disable-next-line no-empty
        } catch (e) {}
    });

    test('update project name and allowed origins', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[1];
        const { projectId } = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );
        const project = await constants.projectsManager.getProjectById(
            projectId!
        );

        const newName = 'ProjectNewName';
        const newAllowedOrigins = [
            'http://localhost:3001',
            'http://localhost:3002'
        ];
        await project.updateProject(newName, newAllowedOrigins);

        const updatedProject = await constants.projectsManager.getProjectById(
            projectId!
        );
        await updatedProject.readyPromise;

        expect(project).toEqual(
            expect.objectContaining({
                owner: ownerScw,
                name: newName,
                allowedOrigins: newAllowedOrigins,
                projectId
            })
        );

        expect(updatedProject).toEqual(
            expect.objectContaining({
                owner: ownerScw,
                name: newName,
                allowedOrigins: newAllowedOrigins,
                projectId
            })
        );

        await constants.projectsManager.removeProject(projectId!);
    });

    test('add then removes from contract whitelist', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[2];
        const { projectId } = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );
        const project = await constants.projectsManager.getProjectById(
            projectId!
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);

        const gasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(gasTank);

        const newContractAddress = '0x789';

        await gasTank.addToWhiteList(newContractAddress);

        const gasTankRaw = (await project.getGasTanksRaw()).find(
            (curGasTank) =>
                curGasTank.chain_id === gasTankProps.chainId.toString()
        );

        expect(gasTankRaw).toEqual(
            expect.objectContaining({
                whitelist: expect.arrayContaining([
                    ...gasTankWhiteList,
                    newContractAddress
                ])
            })
        );

        await gasTank.removeFromWhiteList(newContractAddress);

        const gasTankRawAgain = (await project.getGasTanksRaw()).find(
            (curGasTank) =>
                curGasTank.chain_id === gasTankProps.chainId.toString()
        );

        expect(gasTankRawAgain).toEqual(
            expect.objectContaining({
                whitelist: expect.arrayContaining(gasTankWhiteList)
            })
        );

        await constants.projectsManager.removeProject(projectId!);
    });

    test('update gasTank provider url', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[3];
        const { projectId } = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );
        const project = await constants.projectsManager.getProjectById(
            projectId!
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);

        const gasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(gasTank);

        const newProviderURL =
            'https://eth-goerli.g.alchemy.com/v2/yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy';
        await gasTank.updateGasTankProviderUrl(newProviderURL);

        const updatedGasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(updatedGasTank);

        expect(gasTank).toEqual(
            expect.objectContaining({
                chainId: `${gasTankProps.chainId}`,
                providerURL: newProviderURL
            })
        );

        expect(updatedGasTank).toEqual(
            expect.objectContaining({
                chainId: `${gasTankProps.chainId}`,
                providerURL: newProviderURL
            })
        );

        await constants.projectsManager.removeProject(projectId!);
    });

    test('project has a gas tank', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[4];
        const project = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);

        // By chain id
        const gasTankByChainId = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(gasTankByChainId);
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

        await constants.projectsManager.removeProject(project.projectId!);
    });

    test('project tries to add two gas tanks on the same network', async () => {
        const { name, ownerScw, allowedOrigins } = mockProjects[5];
        const project = await constants.projectsManager.addProject(
            name,
            ownerScw,
            allowedOrigins
        );

        await project.addGasTank(gasTankProps, gasTankWhiteList);
        const gasTank = await project.loadAndGetGasTankByChainId(
            gasTankProps.chainId,
            false
        );
        createdEntities.push(gasTank);

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

        await constants.projectsManager.removeProject(project.projectId!);
    });
});
