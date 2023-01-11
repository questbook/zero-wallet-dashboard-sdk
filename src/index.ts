import Project from './lib/Project';
import ProjectsManager from './lib/ProjectsManager';
import { configEnv } from './utils/global';

configEnv();

export { Project, ProjectsManager };
export * from './types';
