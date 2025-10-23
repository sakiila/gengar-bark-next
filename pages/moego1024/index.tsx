import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';

// 定义词云配置类型
interface WordCloudOptions {
  list: [string, number][];
  gridSize?: number;
  weightFactor?: number | ((size: number) => number);
  fontFamily?: string;
  color?: string | ((word: string, weight: number) => string);
  backgroundColor?: string;
  rotateRatio?: number;
  minRotation?: number;
  maxRotation?: number;
  shuffle?: boolean;
  shape?: string;
  clearCanvas?: boolean;
  drawOutOfBound?: boolean;
}

declare global {
  interface Window {
    WordCloud: (canvas: HTMLCanvasElement, options: WordCloudOptions) => void;
  }
}

const MoeGo1024: NextPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取用户名字数据
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const response = await fetch('/api/moego1024/users');
        if (!response.ok) {
          throw new Error('Failed to fetch names');
        }
        const data = await response.json();
        setNames(data.names || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchNames();
  }, []);

  // 生成词云
  useEffect(() => {
    if (!canvasRef.current || names.length === 0 || !window.WordCloud) {
      return;
    }

    // 统计名字出现频率（如果有重复）
    const nameFrequency = names.reduce((acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 为了填满形状，我们需要重复名字多次，并使用不同的权重
    const wordList: [string, number][] = [];

    // 每个名字重复 6 次，使用不同权重（大、中、小）来填充空隙
    Object.entries(nameFrequency).forEach(([name, count], index) => {
      // 添加大字号 1 个
      wordList.push([name, 40]);
      // 添加中字号 2 个
      wordList.push([name, 25]);
      wordList.push([name, 20]);
      // 添加小字号 3 个（用于填充缝隙）
      wordList.push([name, 12]);
      wordList.push([name, 10]);
      wordList.push([name, 8]);
    });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 关键：使用反向蒙版
    // 第一步：整个画布填充为浅灰色（阻挡区域）
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    // 第二步：将 "MoeGo 1024" 区域设为白色（允许区域）
    // 这样 wordcloud 会检测到白色区域，并只在这些区域放置词云
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 绘制 "MoeGo" 白色区域 - 增大字体
    const fontSize1 = Math.min(width, height) * 0.35; // 从 0.28 增加到 0.35
    ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
    ctx.fillText('MoeGo', width / 2, height * 0.35);

    // 绘制 "1024" 白色区域 - 增大字体
    const fontSize2 = Math.min(width, height) * 0.4; // 从 0.32 增加到 0.4
    ctx.font = `bold ${fontSize2}px Arial, sans-serif`;
    ctx.fillText('1024', width / 2, height * 0.65);

    // 第三步：配置词云选项
    const options: WordCloudOptions = {
      list: wordList,
      gridSize: 2, // 从 3 减小到 2，提高填充精度
      weightFactor: (size) => {
        // 保持字体大小清晰
        return Math.pow(size, 0.7) * (canvas.width / 1200);
      },
      fontFamily: 'Arial, sans-serif',
      color: () => {
        const colors = [
          '#FF6B6B',
          '#4ECDC4',
          '#45B7D1',
          '#FFA07A',
          '#98D8C8',
          '#6C5CE7',
          '#A29BFE',
          '#FD79A8',
          '#FDCB6E',
          '#E17055',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      },
      backgroundColor: '#ffffff', // 与白色区域匹配
      rotateRatio: 0.5, // 增加旋转比例，让更多文字填充缝隙
      minRotation: -Math.PI / 6,
      maxRotation: Math.PI / 6,
      shuffle: true,
      clearCanvas: false, // 不清除画布，保留蒙版
      drawOutOfBound: false, // 不在边界外绘制
    };

    // 第四步：生成词云
    setTimeout(() => {
      window.WordCloud(canvas, options);

      // 第五步：词云生成后，将浅灰色背景替换为白色
      setTimeout(() => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 遍历所有像素，将浅灰色（#f5f5f5 = rgb(245, 245, 245)）替换为白色
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 检测浅灰色像素（允许一些容差）
          if (r >= 240 && r <= 250 && g >= 240 && g <= 250 && b >= 240 && b <= 250) {
            data[i] = 255;     // R
            data[i + 1] = 255; // G
            data[i + 2] = 255; // B
          }
        }

        ctx.putImageData(imageData, 0, 0);
      }, 1000); // 增加延迟，确保词云完全生成
    }, 100);
  }, [names]);

  // 加载 wordcloud 库
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.WordCloud) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/wordcloud@1.2.2/src/wordcloud2.min.js';
      script.async = true;
      script.onload = () => {
        // 强制重新渲染以触发词云生成
        setLoading((prev) => !prev ? prev : false);
      };
      document.body.appendChild(script);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading MoeGo 1024 Word Cloud...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            MoeGo 1024 Word Cloud
          </h1>
          <p className="text-gray-600 text-lg">
            Celebrating our amazing MoeGo team members
          </p>
          <p className="text-gray-500 mt-2">
            Total members: <span className="font-bold text-purple-600">{names.length}</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="w-full h-auto rounded-lg"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              if (canvasRef.current) {
                const link = document.createElement('a');
                link.download = 'moego-1024-wordcloud.png';
                link.href = canvasRef.current.toDataURL();
                link.click();
              }
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
          >
            Download Word Cloud
          </button>
        </div>

        <div className="mt-12 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Team Members</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {names.map((name, index) => (
              <div
                key={`${name}-${index}`}
                className="bg-gradient-to-br from-blue-50 to-purple-50 px-4 py-2 rounded-lg text-center hover:shadow-md transition-shadow"
              >
                <span className="text-gray-700 font-medium">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoeGo1024;
