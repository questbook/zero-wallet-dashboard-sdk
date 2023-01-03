import dotenv from 'dotenv';

export const configEnv = () => {
    dotenv.config({ path: `.env` });
};

export const delay = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
