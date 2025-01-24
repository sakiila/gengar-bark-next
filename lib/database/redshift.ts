import { DataSource } from 'typeorm';

// 数据库 mysql_prod 的连接配置（用于查询 appointment）
export const redshiftAppointmentDataSource = new DataSource({
    type: 'postgres',
    host: process.env.REDSHIFT_HOST,
    port: process.env.REDSHIFT_PORT ? parseInt(process.env.REDSHIFT_PORT, 10) : 5439,
    database: 'mysql_prod',
    username: process.env.REDSHIFT_USERNAME,
    password: process.env.REDSHIFT_PASSWORD,
    ssl: true,
    entities: [],
    synchronize: false,
    logging: true,
});

// 数据库 pg_moego_order_prod 的连接配置（用于查询 order）
export const redshiftOrderDataSource = new DataSource({
    type: 'postgres',
    host: process.env.REDSHIFT_HOST,
    port: process.env.REDSHIFT_PORT ? parseInt(process.env.REDSHIFT_PORT, 10) : 5439,
    database: 'pg_moego_order_prod',
    username: process.env.REDSHIFT_USERNAME,
    password: process.env.REDSHIFT_PASSWORD,
    ssl: true,
    entities: [],
    synchronize: false,
    logging: true,
});

// 初始化 Appointment 数据库连接
export const initAppointmentConnection = async () => {
    try {
        if (!redshiftAppointmentDataSource.isInitialized) {
            await redshiftAppointmentDataSource.initialize();
            console.log('Redshift Appointment DB connection established.');
        }
        return redshiftAppointmentDataSource;
    } catch (error) {
        console.error('Error during Redshift Appointment DB connection:', error);
        throw error;
    }
};

// 初始化 Order 数据库连接
export const initOrderConnection = async () => {
    try {
        if (!redshiftOrderDataSource.isInitialized) {
            await redshiftOrderDataSource.initialize();
            console.log('Redshift Order DB connection established.');
        }
        return redshiftOrderDataSource;
    } catch (error) {
        console.error('Error during Redshift Order DB connection:', error);
        throw error;
    }
};
