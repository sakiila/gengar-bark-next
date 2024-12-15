import { BuildRecord } from '@/lib/database/entities/BuildRecord';
import { AppDataSource, initializeDatabase } from '../data-source';
import { In, Repository } from 'typeorm';
import { getUser } from '@/lib/database/supabase';

export class BuildRecordService {
  private repository: Repository<BuildRecord>;

  private constructor() {
    this.repository = AppDataSource.getRepository(BuildRecord);
  }

  static async getInstance(): Promise<BuildRecordService> {
    await initializeDatabase();
    return new BuildRecordService();
  }

  async createNow(data: Omit<BuildRecord, 'id' | 'created_at'>): Promise<BuildRecord> {
    const buildRecord = this.repository.create(data);
    return await this.repository.save(buildRecord);
  }

  async create(data: Omit<BuildRecord, 'id'>): Promise<BuildRecord> {
    const buildRecord = this.repository.create(data);
    return await this.repository.save(buildRecord);
  }

  async batchCreate(records: Omit<BuildRecord, 'id' | 'created_at'>[]) {
    // For better performance with large datasets, process in chunks
    const chunkSize = 1000;

    try {
      const promises = [];
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);

        // Create entities from the data
        const buildRecords = chunk.map(record => this.repository.create(record));

        // Add each chunk insert to promises array
        promises.push(
          this.repository
          .createQueryBuilder()
          .insert()
          .into(BuildRecord)
          .values(buildRecords)
          .execute(),
        );
      }

      // Execute all chunks in parallel
      await Promise.all(promises);

    } catch (error) {
      console.error('Error in batch creation:', error);
      throw new Error('Failed to batch create build records');
    }
  }

  async findByEmail(email: string): Promise<BuildRecord[]> {
    return await this.repository.find({
      where: { email },
      order: { created_at: 'DESC' },
    });
  }

  // Optional: Add a method to find records by multiple emails
  async findByEmails(emails: string[]): Promise<BuildRecord[]> {
    return await this.repository.find({
      where: { email: In(emails) },
      order: { created_at: 'DESC' },
    });
  }

  async executeMessages(message: string, userId: string, date: Date) {
    const dbUser = await getUser(userId);
    if (!dbUser) {
      console.error('User not found:', userId);
      return;
    }

    const record = BuildRecordService.extractInfo(message);

    try {
      const buildRecordService = await BuildRecordService.getInstance();

      await buildRecordService.create({
        result: record?.result || '',
        duration: record?.duration || '',
        repository: record?.repository || '',
        branch: record?.branch || '',
        sequence: record?.sequence || '',
        email: dbUser?.[0].email || '',
        user_id: userId,
        text: message,
        created_at: date || new Date(),
      });
    } catch (error) {
      console.error('TypeORM insert Error:', error);
    }
  }

  /**
   * *<https://ci.devops.moego.pet/job/MoeGolibrary/job/moego-server-business/job/feature-account-structure/151/display/redirect|BUILD FAILURE (43 sec) - Moement, Inc » moego-server-business » feature-account-structure #151>*
   * <https://github.com/MoeGolibrary/Boarding_Desktop/actions/runs/12311337827|* Deploy success (4 min 20 sec): Boarding_Desktop » bugfix-time-check (run #12311337827)*>
   */
  static extractInfo(text: string):
    | {
    result: string;
    duration: string;
    repository: string;
    branch: string;
    sequence: string;
  }
    | undefined {
    const boardingDesktopMatch = text.match(/(Deploy \w+): ([\w\s]+) » ([a-zA-Z0-9._-]+) \(#(\d+)\)/i);
    if (boardingDesktopMatch) {
      return {
        result: boardingDesktopMatch[1],
        duration: '',
        repository: boardingDesktopMatch[2],
        branch: boardingDesktopMatch[3],
        sequence: boardingDesktopMatch[4],
      };
    }

    const commonMatch = text.match(
      /(BUILD \w+) \(([\w\s]+)\).*» ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) #(\d+)/i,
    ) || text.match(
      /(BUILD \w+) \(([\w\s]+)\) - MoeGo, Inc » ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) #(\d+)/i,
    ) || text.match(
      /(BUILD \w+) \(([\w\s]+)\) - Moement, Inc » ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) #(\d+)/i,
    ) || text.match(
      /(Deploy \w+) \(([\w\s]+)\): ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) \(run #(\d+)\)/i,
    ) || text.match(
      /(DEPLOY \w+) \(([\w\s]+)\) - MoeGo, Inc » ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) #(\d+)/i,
    ) || text.match(
      /(DEPLOY \w+) \(([\w\s]+)\) - Moement, Inc » ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-.]+) #(\d+)/i,
    );
    if (commonMatch) {
      return {
        result: commonMatch[1],
        duration: commonMatch[2],
        repository: commonMatch[3],
        branch: commonMatch[4],
        sequence: commonMatch[5],
      };
    }

    console.log('no match = ', text);
  }
}
