import { postgres } from '@/lib/database/supabase';

export interface ReportData {
  email: string;
  totalBuilds: number;
  firstBuildTime: string;
  lastBuildTime: string;
  successRate: number;
  avgDurationSeconds: number;
  maxDurationSeconds: number;
  minDurationSeconds: number;
  totalRepositories: number;
  totalBranches: number;
  mostActiveRepository: string;
  monthlyBreakdown: string;
  monthlyData: Array<{
    month: string;
    builds: number;
    successRate: number;
  }>;
  workTimeHeatmap: Array<{
    hour: number;
    day: number;
    value: number;
  }>;
  mostActiveTime: string;
  mostActiveDay: string;
  longestWorkingStreak: number;
  weekendWorkingPercentage: number;
  weekendPattern: string;
  avgDailyBuilds: number;
  buildsRank: number;
  successRateRank: number;
}

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  async getReport2024(email: string): Promise<ReportData | null> {
    try {
      console.log('Querying database for email:', email);

      const { data, error } = await postgres
        .from('report_2024')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error) {
        console.error('Database error:', error);
        return null;
      }

      if (!data) {
        console.log('No data found for email:', email);
        return null;
      }

      console.log('Found data for email:', email);
      return this.transformReportData(data);
    } catch (error) {
      console.error('Error in getReport2024:', error);
      return null;
    }
  }

  private transformReportData(rawData: any): ReportData {
    try {
      // 解析月度数据
      const monthlyData = rawData.monthly_breakdown.split(';').map((month: string) => {
        const matches = month.match(/(\d{4}-\d{2}): (\d+) builds \((\d+\.\d+)% success\)/);
        if (!matches) return { month: '', builds: 0, successRate: 0 };
        return {
          month: matches[1],
          builds: parseInt(matches[2]),
          successRate: parseFloat(matches[3])
        };
      });

      // 创建完整的热力图数据结构
      const heatmapData = new Array(7 * 24).fill(null).map((_, index) => ({
        day: Math.floor(index / 24),
        hour: index % 24,
        value: 0
      }));

      // 填充实际数据
      if (Array.isArray(rawData.heatmap_data)) {
        rawData.heatmap_data.forEach((item: { day: number; hour: number; value: number }) => {
          const index = item.day * 24 + item.hour;
          if (index >= 0 && index < heatmapData.length) {
            heatmapData[index].value = item.value;
          }
        });
      }

      return {
        email: rawData.email,
        totalBuilds: rawData.total_builds,
        firstBuildTime: rawData.first_build_time,
        lastBuildTime: rawData.last_build_time,
        successRate: rawData.success_rate,
        avgDurationSeconds: rawData.avg_duration_seconds,
        maxDurationSeconds: rawData.max_duration_seconds,
        minDurationSeconds: rawData.min_duration_seconds,
        totalRepositories: rawData.total_repositories,
        totalBranches: rawData.total_branches,
        mostActiveRepository: rawData.most_active_repository,
        monthlyBreakdown: rawData.monthly_breakdown,
        monthlyData,
        workTimeHeatmap: heatmapData,
        mostActiveTime: rawData.most_active_time,
        mostActiveDay: rawData.most_active_day,
        longestWorkingStreak: rawData.longest_working_streak,
        weekendWorkingPercentage: rawData.weekend_working_percentage,
        weekendPattern: rawData.weekend_pattern,
        avgDailyBuilds: rawData.avg_daily_builds,
        buildsRank: rawData.builds_rank,
        successRateRank: rawData.success_rate_rank,
      };
    } catch (error) {
      console.error('Error transforming data:', error);
      throw new Error(`Data transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}
