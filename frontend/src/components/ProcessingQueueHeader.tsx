import React from 'react';
import { Activity } from 'lucide-react';

const ProcessingQueueHeader: React.FC = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
        <Activity className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Processing Queue</h1>
        <p className="text-sm text-gray-500">Monitor background image processing</p>
      </div>
    </div>
  );
};

export default ProcessingQueueHeader;

