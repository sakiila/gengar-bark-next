import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  EmailIcon,
  EmailShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WeiboIcon,
  WeiboShareButton,
} from 'react-share';
import { useRouter } from 'next/router';
import { ErrorMessage, LoadingSpinner, NoDataFound } from '@/components/ui';
import Image from 'next/image';
import Link from 'next/link';
import { IoMusicalNotes, IoMusicalNotesOutline } from 'react-icons/io5';

interface MonthlyData {
  month: string;
  builds: number;
  successRate: number;
}

interface BuildReport {
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
  monthlyData: MonthlyData[];
  workTimeHeatmap: {
    hour: number;
    day: number;
    value: number;
  }[];
  mostActiveTime: string;
  mostActiveDay: string;
  longestWorkingStreak: number;
  weekendWorkingPercentage: number;
  weekendPattern: string;
  avgDailyBuilds: number;
  buildsRank: number;
  successRateRank: number;
}

const StartPage = ({ onAccept }: { onAccept: () => void }) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <motion.div
      className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="absolute top-20 right-20"
        animate={{
          y: [0, -15, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly6.png"
          alt="Decorative element"
          width={400}
          height={400}
          className="opacity-90"
          priority
        />
      </motion.div>

      <div className="max-w-2xl mx-auto text-center text-white relative z-10 p-8">
        <h1 className="text-6xl font-bold mb-8">2024 MoeGo CI 构建年度报告</h1>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8">
          <p className="text-lg mb-6">
            在查看您的年度报告之前，请仔细阅读并同意我们的隐私政策。
          </p>

          <div className="flex items-center justify-center gap-2 mb-8">
            <input
              type="checkbox"
              id="privacy-accept"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/10 text-purple-600
                focus:ring-purple-500 focus:ring-offset-0"
            />
            <label htmlFor="privacy-accept" className="text-white/90">
              我已阅读并同意
              <Link
                href="/report/privacy-policy"
                target="_blank"
                className="text-purple-300 hover:text-purple-200 underline mx-1"
              >
                隐私政策
              </Link>
            </label>
          </div>

          <motion.button
            onClick={onAccept}
            disabled={!accepted}
            className={`px-8 py-3 rounded-xl font-medium transition-all duration-200
              ${accepted
              ? 'bg-white text-purple-600 hover:bg-purple-100 hover:shadow-lg transform hover:-translate-y-0.5'
              : 'bg-white/20 text-white/40 cursor-not-allowed'
            }`}
            whileHover={accepted ? { scale: 1.02 } : {}}
            whileTap={accepted ? { scale: 0.98 } : {}}
          >
            开始浏览
          </motion.button>
        </div>

        <p className="text-white/70 text-sm">
          *注意：本次数据统计因为技术原因，可能会有一定失真，仅供参考。
        </p>
        <p className="text-white/70 text-sm">
          如有任何问题，请联系 bob@moego.pet
        </p>
      </div>
    </motion.div>
  );
};

const CoverPage = ({ email }: { email: string }) => (
  <motion.div
    className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 relative overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1 }}
  >
    <motion.div
      className="absolute top-20 right-20"
      animate={{
        y: [0, -15, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Image
        src="/assets/saly6.png"
        alt="Decorative element"
        width={400}
        height={400}
        className="opacity-90"
        priority
      />
    </motion.div>


    <motion.div
      className="absolute bottom-20 left-20"
      animate={{
        y: [0, -15, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Image
        src="/assets/saly0.png"
        alt="Decorative element"
        width={300}
        height={300}
        className="opacity-90"
        priority
      />
    </motion.div>

    <div className="text-center text-white relative z-10">
      <h1 className="text-6xl font-bold mb-8">2024 MoeGo CI 年度报告</h1>
      <p className="text-2xl opacity-80">{email}</p>
      <p className="mt-12 text-lg animate-bounce">
        向下滑动查看您的年度总结
        <span className="block text-3xl mt-2">↓</span>
      </p>
    </div>
  </motion.div>
);

const StatCard = ({ title, value, description }: { title: string; value: string | number; description?: string }) => (
  <motion.div
    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white"
    whileHover={{ scale: 1.05 }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <h3 className="text-lg opacity-80 mb-2">{title}</h3>
    <p className="text-4xl font-bold mb-2">{value}</p>
    {description && <p className="text-sm opacity-70">{description}</p>}
  </motion.div>
);

const SummaryCard = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    className="mt-20 max-w-2xl mx-auto px-8 relative"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    {/* 装饰性背景元素 */}
    <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-white/40 via-white/20 to-transparent rounded-full" />

    {/* 引号装饰 - 调整位置和样式 */}
    <div className="absolute -top-8 -left-2 text-5xl text-white/20 font-mashan transform -rotate-6">『</div>
    <div className="absolute -bottom-10 -right-2 text-5xl text-white/20 font-mashan transform rotate-6">』</div>

    {/* 主要内容容器 */}
    <div className="relative">
      {/* 文本内容 */}
      <p
        className="text-xl leading-relaxed tracking-wider whitespace-pre-line
          font-wenkai text-white/90 px-8 py-6"
        style={{
          textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          letterSpacing: '0.05em',
          lineHeight: 2,
        }}
      >
        {children}
      </p>

      {/* 背景装饰效果 */}
      <div className="absolute -inset-4 bg-white/10 rounded-2xl -z-10 backdrop-blur-sm" />
      <div className="absolute -inset-4 bg-gradient-to-r from-white/15 to-transparent
        rounded-2xl -z-20 opacity-50 blur-xl" />

      {/* 发光边框效果 */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-white/30 via-transparent to-white/30
        rounded-2xl opacity-50 -z-5" />
    </div>

    {/* 装饰性点缀 */}
    <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-white/50 shadow-glow" />
    <div className="absolute -bottom-2 -left-2 w-2 h-2 rounded-full bg-white/50 shadow-glow" />

    {/* 添加小装饰元素 */}
    <div className="absolute top-1/2 -right-8 w-1 h-1 rounded-full bg-white/60" />
    <div className="absolute top-1/4 -left-8 w-1 h-1 rounded-full bg-white/60" />
    <div className="absolute bottom-1/4 -right-6 w-1 h-1 rounded-full bg-white/60" />
  </motion.div>
);

const OverviewPage = ({ data }: { data: BuildReport }) => {
  const getSummary = () => {
    if (data.buildsRank <= 10) {
      return `✨ 我去！你是开发机器人吗？在 67 名开发者中排名第 ${data.buildsRank}，这也太强了吧！\n
      🏆 ${data.totalBuilds} 次构建，${data.successRate}% 的成功率，简直就是 CI 届的顶流！\n
      💫 继续保持这份热情，你就是最闪亮的那颗星！`;
    } else if (data.buildsRank <= 30) {
      return `🌟 很不错哦！排名第 ${data.buildsRank}，稳居中上游选手～\n
      ✨ ${data.totalBuilds} 次���建证明了你的勤奋，${data.successRate}% 的成功率也相当可观！\n
      💪 继续冲啊，下次年度报告争取进前十！`;
    } else {
      return `🌈 嘿！虽然目前排在第 ${data.buildsRank} 名，但每个人都是自己的主角！\n
      ✨ ${data.totalBuilds} 次构建和 ${data.successRate}% 的成功率都是你努力的见证～\n
      🎯 慢慢来，比较快，期待明年的你能创造更多惊喜！`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-8 relative">
      <motion.div
        className="absolute bottom-40 left-40"
        animate={{
          x: [0, 20, 0],
          rotate: [0, 10, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly2.png"
          alt="Decorative element"
          width={500}
          height={500}
          className="opacity-80"
        />
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-12">构建概览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="总构建通知次数"
            value={data.totalBuilds}
            description="统计时间为 2024 年 1 月 1 日 至 12 月 15 日"
          />
          <StatCard
            title="首次使用构建通知"
            value={new Date(data.firstBuildTime).toLocaleDateString('ja-JP')}
          />
          <StatCard
            title="总体排名"
            value={`构建量第 ${data.buildsRank} 名`}
            description={`共 67 名使用 Gengar Bark 研发`}
          />
          <StatCard
            title="构建成功率"
            value={`${data.successRate}%`}
            description={data.successRateRank <= 30 ? `排名第 ${data.successRateRank} 名（共 67 名）` : undefined}
          />
        </div>
        <SummaryCard>{getSummary()}</SummaryCard>
      </div>
    </div>
  );
};

const PerformancePage = ({ data }: { data: BuildReport }) => {
  const getSummary = () => {
    const avgMinutes = Math.round(data.avgDurationSeconds / 60);
    const maxMinutes = Math.round(data.maxDurationSeconds / 60);

    let message = '';
    if (avgMinutes <= 5) {
      message = `✨ 卧槽，构建速度太快了吧！平均只需要 ${avgMinutes} 分钟，这效率简直起飞~ `;
    } else if (avgMinutes <= 10) {
      message = `⚡️ 构建速度相当不错呢，平均 ${avgMinutes} 分钟就能搞定，摸鱼时间又多`;
    } else {
      message = `🚀 平均构建用时 ${avgMinutes} 分钟，摸鱼时间刚刚好，不过要是能再快点就更好啦～`;
    }

    if (maxMinutes >= 30) {
      message += `\n💭 不过最长构建居然花了 ${maxMinutes} 分钟...是不是代码太多了��，建议优化一下哦！`;
    }

    if (data.totalRepositories >= 10) {
      message += `\n🎯 哇塞！管理了 ${data.totalRepositories} 个仓库，${data.totalBranches} 个分支，你就是传说中的多线程开发者吧！`;
    } else {
      message += `\n🎯 专注于 ${data.totalRepositories} 个仓库的开发，${data.totalBranches} 个分支井井有条，继续保持哦！`;
    }

    return message;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-8 relative">
      <motion.div
        className="absolute bottom-40 right-40"
        animate={{
          y: [0, -15, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly3.png"
          alt="Decorative element"
          width={500}
          height={500}
          className="opacity-80"
        />
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-12">构建表现</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="平均构建时长"
            value={`${Math.round(data.avgDurationSeconds / 60)} 分钟`}
          />
          <StatCard
            title="最长构建时长"
            value={`${Math.round(data.maxDurationSeconds / 60)} 分钟`}
          />
          <StatCard
            title="使用到的仓库数量"
            value={data.totalRepositories}
          />
          <StatCard
            title="使用到的分支数量"
            value={data.totalBranches}
          />
        </div>
        <SummaryCard>{getSummary()}</SummaryCard>
      </div>
    </div>
  );
};

const MonthlyTrendsPage = ({ data }: { data: BuildReport }) => {
  const getSummary = () => {
    const monthlyData = data.monthlyData || [];
    const maxBuildsMonth = monthlyData.reduce((max, curr) =>
      curr.builds > max.builds ? curr : max, monthlyData[0]);
    const minBuildsMonth = monthlyData.reduce((min, curr) =>
      curr.builds < min.builds ? curr : min, monthlyData[0]);

    let message = `📈 ${maxBuildsMonth.month} 简直就是你的开挂月！${maxBuildsMonth.builds} 次构建，这么拼是要起啊！\n`;

    if (maxBuildsMonth.successRate > 90) {
      message += `🎯 而且高峰期还保持了 ${maxBuildsMonth.successRate}% 的成功率，稳得一批！\n`;
    }

    message += `📊 相比之下 ${minBuildsMonth.month} 佛系了一点，${minBuildsMonth.builds} 次构建，是不是出去度假了呢？\n`;

    if (minBuildsMonth.successRate < maxBuildsMonth.successRate) {
      message += `💭 不过低谷期也要保持热情哦，代码质量都是对自己负责呢！`;
    } else {
      message += `✨ 即使构建少的时候也保持了很高的成功率，这波稳！`;
    }

    return message;
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-8 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="absolute bottom-40 left-40"
        animate={{
          y: [0, -15, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly4.png"
          alt="Decorative element"
          width={500}
          height={500}
          className="opacity-90"
        />
      </motion.div>

      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-12">月度构建趋势</h2>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff33" />
              <XAxis dataKey="month" stroke="#fff" />
              <YAxis stroke="#e7dab7" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tickFormatter={(value) => `${value}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value, name) => {
                  if (name === 'builds') return [value, '构建次数'];
                  if (name === 'successRate') return [`${value}%`, '成功率'];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="builds"
                stroke="#e7dab7"
                strokeWidth={2}
                dot={{ fill: '#e7dab7' }}
              />
              <Line
                type="monotone"
                dataKey="successRate"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ fill: '#82ca9d' }}
                yAxisId="right"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <SummaryCard>{getSummary()}</SummaryCard>
      </div>
    </motion.div>
  );
};

const WorkingPatternPage = ({ data }: { data: BuildReport }) => {
  const getSummary = () => {
    const hour = parseInt(data.mostActiveTime.split(':')[0]);
    let message = '';

    if (hour >= 22 || hour <= 5) {
      message = `🌙 深夜代码人！${data.mostActiveTime} 是你最活跃的时间，熬夜伤身，但我懂你～\n
      🌟 连续 ${data.longestWorkingStreak} 天的工作streak，这份执着真是让人佩服！`;
    } else if (hour >= 6 && hour <= 9) {
      message = `🌅 早起打工魂！${data.mostActiveTime} 就开始冲，这么自律真的绝了！\n
      ✨ ${data.longestWorkingStreak} 天的工作streak，卷王本王就是你吧！`;
    } else if (hour >= 18 && hour <= 21) {
      message = `🌆 夜晚才是你的主场！${data.mostActiveTime} 的专注力简直MAX！\n
      💫 ${data.longestWorkingStreak} 天连续工作，这波节奏很稳啊！`;
    } else {
      message = `☀️ 朝九晚五工作狂！${data.mostActiveTime} 的你保持着最佳状态～\n
      🎯 ${data.longestWorkingStreak} 天的工作streak，这份规律值得表扬！`;
    }

    if (data.weekendWorkingPercentage > 30) {
      message += `\n💝 周末也有 ${data.weekendWorkingPercentage}% 的时间在线，记得劳逸结合，多陪陪家人哦！`;
    }

    return message;
  };

  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const maxValue = Math.max(...data.workTimeHeatmap.map(item => item.value));

  // 计算圆圈半径的函数
  const calculateRadius = (value: number) => {
    const minRadius = 4;
    const maxRadius = 12;
    if (value === 0) return minRadius;
    return minRadius + ((value / maxValue) * (maxRadius - minRadius));
  };

  // 计算透明度的函数
  const calculateOpacity = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return 0.03;
    if (intensity < 0.2) return 0.2;
    if (intensity < 0.4) return 0.4;
    if (intensity < 0.6) return 0.6;
    if (intensity < 0.8) return 0.8;
    return 1;
  };

  // 自定义悬浮窗内容
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900/95 backdrop-blur-lg px-6 py-4 rounded-2xl border border-purple-500/30 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-purple-400" />
            <p className="text-gray-200 font-medium text-lg">
              {days[data.day]} {String(data.hour).padStart(2, '0')}:00
            </p>
          </div>
          <p className="text-white text-2xl font-bold">
            {data.value} <span className="text-base font-normal text-gray-300">次构建</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-500 p-8 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >

      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly13.png"
          alt="Decorative element"
          width={800}
          height={800}
          className="opacity-90 cursor-pointer"
        />
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-12">工作模式分析</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="最长连续工作日天数"
            value={data.longestWorkingStreak}
            description="天"
          />
          <StatCard
            title="周末工作占比"
            value={`${data.weekendWorkingPercentage}%`}
            description={data.weekendPattern}
          />
          <StatCard
            title="最活跃时间"
            value={data.mostActiveTime}
          />
          <StatCard
            title="最活跃工作日"
            value={data.mostActiveDay}
          />
        </div>

        <div className="mt-12 bg-white/10 backdrop-blur-lg rounded-xl p-6 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ffffff22"
                vertical={true}
                horizontal={true}
              />
              <XAxis
                type="number"
                dataKey="hour"
                name="时间"
                domain={[0, 23]}
                tickFormatter={(hour) => `${String(hour).padStart(2, '0')}时`}
                stroke="#fff"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="day"
                name="日期"
                domain={[0, 6]}
                tickFormatter={(day) => days[day]}
                stroke="#fff"
                reversed
                tick={{ fontSize: 12 }}
              />
              <ZAxis
                type="number"
                dataKey="value"
                range={[30, 60]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: '#ffffff44',
                  strokeWidth: 2,
                  strokeDasharray: '4 4',
                  radius: 8,
                }}
              />
              <Scatter
                data={data.workTimeHeatmap}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const radius = calculateRadius(payload.value);
                  return (
                    <g>
                      {/* 外圈光晕效果 */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 1}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth={0.5}
                        opacity={0.3}
                      />
                      {/* 主圆圈 */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="#c084fc"
                        fillOpacity={calculateOpacity(payload.value)}
                        stroke="#ffffff33"
                        strokeWidth={0.5}
                        className="transition-all duration-200 hover:stroke-white hover:stroke-2"
                      />
                    </g>
                  );
                }}
                fill="#c084fc"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <SummaryCard>{getSummary()}</SummaryCard>
      </div>
    </motion.div>
  );
};

const RepositoryStatsPage = ({ data }: { data: BuildReport }) => {
  const getSummary = () => {
    const buildCount = data.mostActiveRepository.match(/(\d+) 次构建/)?.[1] || '0';
    const successRate = data.mostActiveRepository.match(/(\d+\.?\d*)% 成功率/)?.[1] || '0';

    let message = `📚 在 ${data.totalRepositories} 个仓库中，你对 ${data.mostActiveRepository.split(' ')[0]} 情有独钟，贡献了 ${buildCount} 次构建。`;

    if (parseFloat(successRate) > 90) {
      message += ` 而且 ${successRate}% 的成功率真是太棒了！`;
    } else if (parseFloat(successRate) > 80) {
      message += ` ${successRate}% 的成功率还不错，继续加油！`;
    } else {
      message += ` 建议关注一下 ${successRate}% 的成功率，也许可以找找提升的��间。`;
    }

    if (data.weekendWorkingPercentage > 30) {
      message += `\n💝 周末也在努力工作，记得劳逸结合哦！`;
    }

    return message;
  };

  // 解析 mostActiveRepository 字符串
  const [repoName, ...details] = data.mostActiveRepository.split(' ');
  const detailsStr = details.join(' ');

  // 解析详信息
  const buildCount = detailsStr.match(/(\d+) 次构建/)?.[1] || '0';
  const successRate = detailsStr.match(/(\d+\.?\d*)% 成功率/)?.[1] || '0';
  const firstBuild = detailsStr.match(/首次: ([\d-: ]+)/)?.[1] || '';
  const lastBuild = detailsStr.match(/最后: ([\d-: ]+)/)?.[1] || '';

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-500 p-8 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="absolute bottom-40 right-40"
        animate={{
          x: [0, 15, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/assets/saly8.png"
          alt="Decorative element"
          width={500}
          height={500}
          className="opacity-80"
        />
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-12">仓库统计</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="日均构建次数"
            value={`${data.avgDailyBuilds}`}
            description="次"
          />
          <StatCard
            title="活跃时间跨度"
            value={`${new Date(firstBuild).toLocaleDateString('zh-CN')} ~ ${new Date(lastBuild).toLocaleDateString('zh-CN')}`}
            description={`${Math.round((new Date(lastBuild).getTime() - new Date(firstBuild).getTime()) / (1000 * 60 * 60 * 24))} 天`}
          />
          <StatCard
            title="最活跃仓库"
            value={repoName}
            description={`${buildCount} 次构建`}
          />
          <StatCard
            title="最活跃仓库构建成功率"
            value={`${successRate}%`}
          />
        </div>
        <SummaryCard>{getSummary()}</SummaryCard>
      </div>
    </motion.div>
  );
};

const ShareSection = ({ data }: { data: BuildReport }) => {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = `查看我的 2024 MoeGo CI 年度报告！总构建次数：${data.totalBuilds}，成功率：${data.successRate}%`;

  return (
    <div className="fixed bottom-8 right-8 flex gap-4 bg-black/20 backdrop-blur-lg p-4 rounded-full">
      <TwitterShareButton url={shareUrl} title={shareTitle}>
        <TwitterIcon size={32} round />
      </TwitterShareButton>
      <LinkedinShareButton url={shareUrl} title={shareTitle}>
        <LinkedinIcon size={32} round />
      </LinkedinShareButton>
      <WeiboShareButton url={shareUrl} title={shareTitle}>
        <WeiboIcon size={32} round />
      </WeiboShareButton>
      <EmailShareButton url={shareUrl} subject="2024 MoeGo CI 年度报告" body={shareTitle}>
        <EmailIcon size={32} round />
      </EmailShareButton>
    </div>
  );
};

const FeedbackPage = () => {
  const router = useRouter();
  const { username } = router.query as { username: string };
  const lowerCaseUsername = username?.toLowerCase();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !lowerCaseUsername || isSubmitting) return;

    setIsSubmitting(true);
    const submittedFeedback = feedback.trim();

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: lowerCaseUsername,
          feedback: submittedFeedback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '提交反馈失败');
      }

      setSubmitStatus('success');

      setTimeout(() => {
        setSubmitStatus('idle');
        setFeedback('');
      }, 10000);

    } catch (error) {
      console.error('提交反馈失败:', error);
      setSubmitStatus('error');

      setTimeout(() => {
        setSubmitStatus('idle');
      }, 10000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextareaFocus = () => {
    if (submitStatus === 'success') {
      setSubmitStatus('idle');
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-8 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <Image
          src="/assets/saly14.png"
          alt="Decorative element"
          width={400}
          height={400}
          className="opacity-90"
        />
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold text-white mb-4">反馈建议</h2>

        {/* 添加引导文字 */}
        <div className="mb-8 text-white/80 space-y-3">
          <p className="text-lg">
            感谢您使用 Gengar Bark！我们非常重视您的反馈和建议。
          </p>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 space-y-2">
            <p>您可以告诉我们：</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>对年度报告的展示效果有什么想法</li>
              <li>希望看到哪些新的数据维度</li>
              <li>发现了任何问题或 bug</li>
              <li>对 Gengar Bark 服务的建议</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="feedback" className="block text-white/90 text-sm font-medium">
              您的反馈（字数不限）
            </label>
            <div className="relative group">
              <div
                className="absolute inset-0 bg-white/10 backdrop-blur-lg rounded-xl
                  group-focus-within:bg-white/15 transition-colors duration-200"
                aria-hidden="true"
              />
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onFocus={handleTextareaFocus}
                placeholder="请输入您的想法..."
                className="relative w-full h-40 px-4 py-3 rounded-xl bg-transparent
                  text-white placeholder-white/50
                  focus:outline-none focus:ring-0
                  resize-none border-0"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={isSubmitting || !feedback.trim()}
              className={`w-full py-3 rounded-xl font-medium transition-all duration-200
                ${isSubmitting || !feedback.trim()
                ? 'bg-white/20 text-white/40 cursor-not-allowed'
                : 'bg-white/20 text-white hover:bg-white/30 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0'}`}
            >
              {isSubmitting ? '提交中...' : '提交反馈'}
            </button>
          </div>
          {submitStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/20 backdrop-blur-lg border border-green-500/30
                rounded-xl p-4 text-center text-green-300"
            >
              <p className="font-medium">感谢您的反馈！</p>
              <p className="text-sm opacity-80">
                {feedback.replace(/[\s.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').length > 10 ? '恭喜你发现小彩蛋！请去找 Bob 领取小礼品，数量有限，先到先得！' : '我们会认真考虑您的建议！'}
              </p>
            </motion.div>
          )}
          {submitStatus === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 backdrop-blur-lg border border-red-500/30
                rounded-xl p-4 text-center text-red-300"
            >
              <p className="font-medium">提交失败</p>
              <p className="text-sm opacity-80">请稍后重试</p>
            </motion.div>
          )}
        </form>
      </div>
    </motion.div>
  );
};

const Footer = () => (
  <motion.div
    className="bg-black/30 backdrop-blur-lg text-white/70 py-6 px-8"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
  >
    <div className="max-w-4xl mx-auto text-center space-y-3">
      <div className="text-sm space-y-1">
        <p>© 2024 Gengar Bark. All rights reserved.</p>
        <p>
          Powered by{' '}
          <a
            href="https://baobo.me"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors duration-200"
          >
            https://baobo.me
          </a>
        </p>
      </div>
    </div>
  </motion.div>
);

// 在文件顶部添加错误边界组件
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (error: Error) => {
      console.error('Caught error:', error);
      setError(error);
      setHasError(true);
    };

    window.addEventListener('error', (e) => handleError(e.error));
    window.addEventListener('unhandledrejection', (e) => handleError(e.reason));

    return () => {
      window.removeEventListener('error', (e) => handleError(e.error));
      window.removeEventListener('unhandledrejection', (e) => handleError(e.reason));
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-500">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-lg mx-auto text-white">
          <h2 className="text-2xl font-bold mb-4">页面出错了</h2>
          <p className="mb-4 opacity-80">{error?.message || '发生未知错误'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function Report() {
  const router = useRouter();
  const { username } = router.query as { username: string };
  const lowerCaseUsername = username?.toLowerCase();
  const [data, setData] = useState<BuildReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // 获取报告数据
  useEffect(() => {
    const fetchReport = async () => {
      if (!lowerCaseUsername) {
        console.log('No username provided');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const email = `${lowerCaseUsername}@moego.pet`;
        console.log('Fetching report for:', email);

        const response = await fetch(`/api/report/2024/${encodeURIComponent(email)}`);
        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (response.status === 404) {
          setError(`未找到用户 ${username} 的报告`);
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || '获取报告失败');
        }

        setData(data);
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(err instanceof Error ? err.message : '发生未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [username, lowerCaseUsername]);

  // 处理触摸事件
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const touchStartX = e.touches[0].clientX;
      const touchStartY = e.touches[0].clientY;
      const deltaX = touchStartX - e.touches[0].clientX;
      const deltaY = touchStartY - e.touches[0].clientY;

      // If horizontal scroll is greater than vertical scroll, prevent default
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }
    };

    if (typeof window !== 'undefined') {
      const container = document.querySelector('.snap-y');
      if (container) {
        container.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        return () => {
          container.removeEventListener('touchmove', handleTouchMove as EventListener);
        };
      }
    }
  }, []);

  // 优化音频初始化和错误处理
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio();
        
        // 添加错误处理
        const handleError = (e: ErrorEvent) => {
          console.error('音频加载失败:', e);
          setIsPlaying(false);
          setAudioElement(null);
        };

        // 添加加载处理
        const handleCanPlayThrough = () => {
          console.log('音频加载完成，可以播放');
        };

        audio.addEventListener('error', handleError);
        audio.addEventListener('canplaythrough', handleCanPlayThrough);

        // 设置音频属性
        audio.loop = true;
        audio.volume = 0.3;
        audio.preload = 'auto';
        
        // 最后设置音频源
        audio.src = '/assets/心要野-后海大鲨鱼.mp3';

        setAudioElement(audio);

        // 清理函数
        return () => {
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
          audio.pause();
          audio.src = '';
          audio.remove();
        };
      } catch (error) {
        console.error('音频初始化失败:', error);
      }
    }
  }, []);

  // 优化音乐控制处理函数
  const handleMusicToggle = async () => {
    if (!audioElement) {
      console.log('音频元素未初始化');
      return;
    }

    try {
      if (!isPlaying) {
        // 重新加载音频
        audioElement.currentTime = 0;
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('开始播放音频');
              setIsPlaying(true);
            })
            .catch(error => {
              console.error('播放失败:', error);
              setIsPlaying(false);
            });
        }
      } else {
        audioElement.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('音频控制失败:', error);
      setIsPlaying(false);
    }
  };

  // 优化 MusicControl 组件
  const MusicControl = () => (
    <motion.button
      className="fixed top-8 left-8 z-50 bg-white/10 backdrop-blur-lg p-4 rounded-full
        hover:bg-white/20 transition-all duration-200 shadow-lg group"
      onClick={handleMusicToggle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      aria-label={isPlaying ? '暂停背景音乐' : '播放背景音乐'}
    >
      <div className="relative">
        {/* 音乐图标 */}
        <motion.div
          animate={isPlaying ? {
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0],
          } : { scale: 1, rotate: 0 }}
          transition={{
            duration: 2,
            repeat: isPlaying ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          <IoMusicalNotes className="w-6 h-6 text-white" />
        </motion.div>

        {/* 禁用状态的斜线 */}
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={false}
          animate={isPlaying ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-1/2 left-1/2 w-8 h-0.5 bg-white/90 -translate-x-1/2 -translate-y-1/2 rotate-45 transform origin-center" />
        </motion.div>

        {/* 播放状态的光晕效果 */}
        {isPlaying && (
          <motion.div
            className="absolute -inset-2 rounded-full bg-white/10"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.2, 0, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>

      {/* 悬浮提示 */}
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm
        rounded-lg text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100
        transition-opacity duration-200 pointer-events-none">
        {isPlaying ? '点击暂停' : '点击播放'}
      </div>
    </motion.button>
  );

  // 添加初始化日志
  useEffect(() => {
    console.log('Report component mounted');
    console.log('Username:', username);
    console.log('Query:', router.query);
  }, [username, router.query]);

  // 确保在客户端渲染前显示加载状态
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingSpinner />;
  }

  // Rest of the component remains the same...
  if (!lowerCaseUsername || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
        <LoadingSpinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-500">
        <ErrorMessage message={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-500 to-red-500">
        <NoDataFound />
      </div>
    );
  }

  if (!privacyAccepted) {
    return <StartPage onAccept={() => setPrivacyAccepted(true)} />;
  }

  const pageTitle = `2024 MoeGo CI 年度报告 | ${data.email}`;
  const pageDescription = `在 2024 年，共完成 ${data.totalBuilds} 次构建，成功率 ${data.successRate}%。最活跃仓库：${data.mostActiveRepository}`;
  const shareImage = '/images/cover.png';

  return (
    <ErrorBoundary>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={shareImage} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={shareImage} />

        {/* 他元数据 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="keywords" content="CI, 持续集成, 年度报告, 构建统计, 开发者报告" />
        <meta name="author" content="Gengar Bark" />

        {/* 颜色主题 */}
        <meta name="theme-color" content="#7c3aed" />

        {/* 禁止缓存，确保数据实时 */}
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
      </Head>
      <MusicControl />
      <div className="snap-y snap-mandatory h-screen overflow-y-scroll overflow-x-hidden touch-pan-y">
        <div className="snap-start">
          <CoverPage email={data.email} />
        </div>
        <div className="snap-start">
          <OverviewPage data={data} />
        </div>
        <div className="snap-start">
          <PerformancePage data={data} />
        </div>
        <div className="snap-start">
          <MonthlyTrendsPage data={data} />
        </div>
        <div className="snap-start">
          <WorkingPatternPage data={data} />
        </div>
        <div className="snap-start">
          <RepositoryStatsPage data={data} />
        </div>
        <div className="snap-start">
          <FeedbackPage />
        </div>
        <Footer />
      </div>
      <ShareSection data={data} />
    </ErrorBoundary>
  );
}
