import { DataSource } from 'typeorm';
import { BuildRecord } from './entities/BuildRecord';
import { Channel } from './entities/Channel';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    synchronize: true,
    logging: false,
    entities: [BuildRecord, Channel],
})

// 初始化函数
export const initializeDatabase = async () => {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("Data Source has been initialized!");
        }
        return AppDataSource;
    } catch (error) {
        console.error("Error during Data Source initialization:", error);
        throw error;
    }
}
