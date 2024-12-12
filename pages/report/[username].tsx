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
  WhatsappIcon,
  WhatsappShareButton,
  TelegramIcon,
  TelegramShareButton, WeiboShareButton, WeiboIcon,
} from 'react-share';
import { useRouter } from 'next/router';
import { ErrorMessage, LoadingSpinner, NoDataFound } from '@/components/ui';
import Image from 'next/image';

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

const OverviewPage = ({ data }: { data: BuildReport }) => (
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
          title="总构建次数"
          value={data.totalBuilds}
          description="在过去的一年中（统计自 2024 年 1 月 25 日）"
        />
        <StatCard
          title="首次构建"
          value={new Date(data.firstBuildTime).toLocaleDateString('ja-JP')}
        />
        <StatCard
          title="总体排名"
          value={`构建量第 ${data.buildsRank} 名`}
          description={`Nam suscipit`}
        />
        <StatCard
          title="构建成功率"
          value={`${data.successRate}%`}
          description={`排名第 ${data.successRateRank} 名（共 67 名）`}
        />
      </div>
    </div>
  </div>
);

const PerformancePage = ({ data }: { data: BuildReport }) => (
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
    </div>
  </div>
);

const MonthlyTrendsPage = ({ data }: { data: BuildReport }) => {
  const monthlyData = data.monthlyData || [];

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
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff33" />
              <XAxis dataKey="month" stroke="#fff" />
              <YAxis stroke="#fff" />
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
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ fill: '#8884d8' }}
              />
              <Line
                type="monotone"
                dataKey="successRate"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ fill: '#82ca9d' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

const WorkingPatternPage = ({ data }: { data: BuildReport }) => {
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
                name="星期"
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
      </div>
    </motion.div>
  );
};

const RepositoryStatsPage = ({ data }: { data: BuildReport }) => (
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
      <div className="grid grid-cols-1 gap-6">
        <StatCard
          title="总体排名"
          value={`构建量第 ${data.buildsRank} 名`}
          description={`共 67 名`}
        />
        <StatCard
          title="日均构建次数"
          value={`${data.avgDailyBuilds} 次`}
          description="Nam suscipit"
        />
        <StatCard
          title="最活跃仓库"
          value={data.mostActiveRepository.split(' ')[0]}
          description={data.mostActiveRepository.split(' ').slice(1).join(' ')}
        />
      </div>
    </div>
  </motion.div>
);

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
  const { username } = router.query;
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !username || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          feedback: feedback.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '提交反馈失败');
      }

      setSubmitStatus('success');
      setFeedback('');

      // 3秒后重置状态
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('提交反馈失败:', error);
      setSubmitStatus('error');

      // 3秒后重置状态
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 3000);
    } finally {
      setIsSubmitting(false);
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
              <p className="text-sm opacity-80">我们会认真考虑您的建议</p>
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

// 修改 ScrollHint 组件样式，使其更醒目
const ScrollHint = () => (
  <motion.div
    className="fixed bottom-24 left-1/2 -translate-x-1/2 text-white/90 text-center pointer-events-none z-50"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="bg-black/30 backdrop-blur-lg px-6 py-3 rounded-full"
    >
      <p className="text-sm mb-2">继续下滑访问我的主页</p>
      <span className="text-2xl">↓</span>
    </motion.div>
  </motion.div>
);

export default function Report() {
  const router = useRouter();
  const { username } = router.query;
  const [data, setData] = useState<BuildReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [canOpenLink, setCanOpenLink] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      if (!username) return;

      try {
        const email = `${username}@moego.pet`;
        console.log('Fetching report for:', email);

        const response = await fetch(`/api/report/2024/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (response.status === 404) {
          setError(`未找到用户 ${username} 的报告`);
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || '获取报告失败');
        }

        setData(data);
      } catch (err) {
        console.error('Error details:', err);
        setError(err instanceof Error ? err.message : '发生未知错误');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [username]);

  // 修改滚动处理逻辑
  useEffect(() => {
    let touchStartY = 0;
    let isAtBottomStart = false;
    let scrollTimeout: NodeJS.Timeout;
    let lastOpenTime = 0;
    let attemptCount = 0;

    const checkIfAtBottom = (element: HTMLElement) => {
      return Math.abs(
        element.scrollHeight - element.scrollTop - element.clientHeight
      ) < 50;
    };

    const openLink = () => {
      const now = Date.now();
      if (now - lastOpenTime > 500) {
        window.open('https://baobo.me', '_blank');
        lastOpenTime = now;
        setShowScrollHint(false);
        attemptCount = 0;
      }
    };

    const handleScroll = (e: Event) => {
      const scrollContainer = e.target as HTMLElement;
      const isAtBottom = checkIfAtBottom(scrollContainer);
      
      clearTimeout(scrollTimeout);
      
      if (isAtBottom) {
        attemptCount++;
        scrollTimeout = setTimeout(() => {
          setShowScrollHint(true);
          setCanOpenLink(true);
          if (attemptCount > 2) {
            openLink();
          }
        }, 50);
      } else {
        setShowScrollHint(false);
        attemptCount = Math.max(0, attemptCount - 1);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const scrollContainer = document.querySelector('.snap-y') as HTMLElement;
      if (!scrollContainer) return;
      
      const isAtBottom = checkIfAtBottom(scrollContainer);
      
      if (isAtBottom) {
        e.preventDefault();
        if (e.deltaY > 0) {
          attemptCount++;
          if (attemptCount > 1) {
            openLink();
          }
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const scrollContainer = document.querySelector('.snap-y') as HTMLElement;
      if (!scrollContainer) return;
      
      touchStartY = e.touches[0].clientY;
      isAtBottomStart = checkIfAtBottom(scrollContainer);
      
      if (isAtBottomStart) {
        setShowScrollHint(true);
        setCanOpenLink(true);
        attemptCount++;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtBottomStart) return;
      
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      
      if (deltaY > 10) {
        attemptCount++;
        if (attemptCount > 1) {
          openLink();
        }
        touchStartY = touchY;
      }
    };

    const container = document.querySelector('.snap-y');
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: false });
      container.addEventListener('wheel', handleWheel as EventListener, { passive: false } as AddEventListenerOptions);
      container.addEventListener('touchstart', handleTouchStart as EventListener);
      container.addEventListener('touchmove', handleTouchMove as EventListener);

      return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('wheel', handleWheel as EventListener);
        container.removeEventListener('touchstart', handleTouchStart as EventListener);
        container.removeEventListener('touchmove', handleTouchMove as EventListener);
      };
    }
  }, [canOpenLink, showScrollHint]);

  // 添加加载状态组件
  if (!username) return <LoadingSpinner />;
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <NoDataFound />;

  const pageTitle = `2024 MoeGo CI 年度报告 | ${data.email}`;
  const pageDescription = `在 2024 年，共完成 ${data.totalBuilds} 次构建，成功率 ${data.successRate}%。最活跃仓库：${data.mostActiveRepository}`;
  const shareImage = '/ci-report-preview.png'; // 需要添加预览图片

  return (
    <>
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
      <div className="snap-y snap-mandatory h-screen overflow-y-scroll">
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
      {showScrollHint && <ScrollHint />}
    </>
  );
}
