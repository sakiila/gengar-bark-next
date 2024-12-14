import { AppDataSource, initializeDatabase } from '../data-source';
import { Channel } from '../entities/Channel';
import { DeepPartial, Repository } from 'typeorm';

export class ChannelService {
  private repository: Repository<Channel>;

  private constructor() {
    this.repository = AppDataSource.getRepository(Channel);
  }

  static async getInstance(): Promise<ChannelService> {
    await initializeDatabase();
    return new ChannelService();
  }

  async saveChannels(channels: DeepPartial<Channel>[]): Promise<Channel[]> {
    return this.repository.save(channels, {
      conflictPaths: ['channel_id'],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  async findAll(): Promise<Channel[]> {
    return this.repository.find();
  }

  async findById(channelId: string): Promise<Channel | null> {
    return this.repository.findOneBy({ channel_id: channelId });
  }
}
