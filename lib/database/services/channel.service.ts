import { AppDataSource, initializeDatabase } from '../data-source';
import { Channel } from '../entities/Channel';
import { DeepPartial, Repository, In } from 'typeorm';

export class ChannelService {
  private repository: Repository<Channel>;

  private constructor() {
    this.repository = AppDataSource.getRepository(Channel);
  }

  static async getInstance(): Promise<ChannelService> {
    await initializeDatabase();
    return new ChannelService();
  }

  async saveChannels(channels: DeepPartial<Channel>[]) {
    if (!channels || channels.length === 0) {
      return;
    }

    // For better performance with large datasets, process in chunks
    const chunkSize = 1000;

    for (let i = 0; i < channels.length; i += chunkSize) {
      const chunk = channels.slice(i, i + chunkSize);

      // Use query builder for upsert operation
      await this.repository
      .createQueryBuilder()
      .insert()
      .into(Channel)
      .values(chunk)
      .orUpdate(
        ['is_archived', 'is_user_deleted'], // specify columns to update
        ['channel_id'], // specify conflict columns
        {
          skipUpdateIfNoValuesChanged: true,
        },
      )
      .execute();
    }
  }

  async findAll(): Promise<Channel[]> {
    return this.repository.find();
  }

  async findById(channelId: string): Promise<Channel | null> {
    return this.repository.findOneBy({ channel_id: channelId });
  }

  async deleteChannels(channelIds: string[]): Promise<void> {
    await this.repository.delete({ channel_id: In(channelIds) });
  }


}
