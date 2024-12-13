import { useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import Image from 'next/image';

const PrivacyPolicy = () => {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const content = {
    zh: {
      title: '隐私政策',
      lastUpdated: '最后更新时间：2024 年 12 月 14 日',
      sections: [
        {
          title: '1. 信息收集',
          content: `我们收集的信息包括：
          • 您的电子邮件地址
          • CI/CD 构建记录和相关统计数据
          • 系统自动收集的技术数据（如访问时间、设备信息等）
          • 您主动提供的反馈信息`
        },
        {
          title: '2. 信息使用',
          content: `我们使用收集的信息：
          • 生成您的个性化年度报告
          • 改进我们的服务质量
          • 发送服务相关通知
          • 进行数据分析和研究`
        },
        {
          title: '3. 信息保护',
          content: `我们采取以下措施保护您的信息：
          • 使用加密技术保护数据传输
          • 限制员工访问权限
          • 定期安全审计
          • 遵守相关法律法规要求`
        },
        {
          title: '4. 信息共享',
          content: `我们不会与第三方共享您的个人信息，除非：
          • 获得您的明确同意
          • 法律法规要求
          • 保护我们的合法权益`
        },
        {
          title: '5. 您的权利',
          content: `您拥有以下权利：
          • 访问您的个人信息
          • 更正不准确的信息
          • 要求删除您的信息
          • 退出数据收集
          • 获取数据副本`
        },
        {
          title: '6. Cookie 使用',
          content: `我们使用 Cookie 和类似技术：
          • 改善用户体验
          • 记住您的偏好设置
          • 分析服务使用情况
          您可以通过浏览器设置控制 Cookie`
        },
        {
          title: '7. 隐私政策更新',
          content: `我们可能会更新本隐私政策。更新时：
          • 在网站公告更新内容
          • 继续使用表示同意新政策`
        },
        {
          title: '8. 联系我们',
          content: `如有隐私相关问题，请联系：
          邮箱：bob@moego.pet
          工作时间：周一至周五 9:30-18:30`
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last Updated: December 14, 2024',
      sections: [
        {
          title: '1. Information Collection',
          content: `We collect the following information:
          • Your email address
          • CI/CD build records and related statistics
          • Technical data automatically collected by our systems
          • Feedback information you actively provide`
        },
        {
          title: '2. Information Usage',
          content: `We use the collected information to:
          • Generate your personalized annual report
          • Improve our service quality
          • Send service-related notifications
          • Conduct data analysis and research`
        },
        {
          title: '3. Information Protection',
          content: `We protect your information through:
          • Encryption for data transmission
          • Limited employee access
          • Regular security audits
          • Compliance with relevant regulations`
        },
        {
          title: '4. Information Sharing',
          content: `We do not share your personal information with third parties unless:
          • We have your explicit consent
          • Required by law
          • To protect our legitimate interests`
        },
        {
          title: '5. Your Rights',
          content: `You have the right to:
          • Access your personal information
          • Correct inaccurate information
          • Request deletion of your information
          • Opt-out of data collection
          • Obtain a copy of your data`
        },
        {
          title: '6. Use of Cookies',
          content: `We use cookies and similar technologies to:
          • Improve user experience
          • Remember your preferences
          • Analyze service usage
          You can control cookies through browser settings`
        },
        {
          title: '7. Policy Updates',
          content: `We may update this privacy policy. When we do:
          • We'll post updates on our website
          • Continued use indicates acceptance`
        },
        {
          title: '8. Contact Us',
          content: `For privacy-related inquiries:
          Email: bob@moego.pet
          Business hours: Monday-Friday 9:30-18:30`
        }
      ]
    }
  };

  return (
    <>
      <Head>
        <title>{content[language].title} | Gengar Bark</title>
        <meta name="description" content="Gengar Bark Privacy Policy" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500">
        <div className="absolute right-0 top-0 -z-10 opacity-20">
          <Image
            src="/assets/saly9.png"
            alt="Decorative element"
            width={600}
            height={600}
          />
        </div>

        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Language Switcher */}
          <div className="flex justify-end mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-full p-1">
              <button
                onClick={() => setLanguage('zh')}
                className={`px-4 py-2 rounded-full transition-all ${
                  language === 'zh'
                    ? 'bg-white text-purple-600'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 rounded-full transition-all ${
                  language === 'en'
                    ? 'bg-white text-purple-600'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-white"
          >
            <h1 className="text-4xl font-bold mb-4">{content[language].title}</h1>
            <p className="text-white/70 mb-8">{content[language].lastUpdated}</p>

            <div className="space-y-8">
              {content[language].sections.map((section, index) => (
                <motion.section
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>
                  <div className="bg-black/10 rounded-xl p-6">
                    <p className="whitespace-pre-line text-white/90">
                      {section.content}
                    </p>
                  </div>
                </motion.section>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
