import { BuildRecord } from "@/lib/database/entities/BuildRecord";
import { AppDataSource, initializeDatabase } from "../data-source";
import { Repository } from "typeorm";

export class BuildRecordService {
    private repository: Repository<BuildRecord>;

    private constructor() {
        this.repository = AppDataSource.getRepository(BuildRecord);
    }

    static async getInstance(): Promise<BuildRecordService> {
        await initializeDatabase();
        return new BuildRecordService();
    }

    async create(data: Omit<BuildRecord, 'id' | 'created_at'>): Promise<BuildRecord> {
        const buildRecord = this.repository.create(data);
        return await this.repository.save(buildRecord);
    }

    async findByEmail(email: string): Promise<BuildRecord[]> {
        return await this.repository.find({
            where: { email },
            order: { created_at: 'DESC' }
        });
    }
}
