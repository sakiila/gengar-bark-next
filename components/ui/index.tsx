import { motion } from 'framer-motion';

export const LoadingSpinner = () => (
  <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
    <motion.div
      className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  </div>
);

export const ErrorMessage = ({ message }: { message: string }) => (
  <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-600 to-pink-500">
    <div className="text-center text-white">
      <h1 className="text-4xl font-bold mb-4">出错了</h1>
      <p className="text-xl opacity-80">{message}</p>
    </div>
  </div>
);

export const NoDataFound = () => (
  <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800">
    <div className="text-center text-white">
      <h1 className="text-4xl font-bold mb-4">未找到数据</h1>
      <p className="text-xl opacity-80">该用户暂无年度报告</p>
    </div>
  </div>
); 