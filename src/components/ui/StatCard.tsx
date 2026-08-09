import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  colorClassName?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  trend?: string;
  trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, title, value, colorClassName, color, trend, trendUp }) => {
  const resolvedColorClassName = colorClassName || (
    color === 'blue' ? 'bg-blue-500' :
    color === 'green' ? 'bg-green-500' :
    color === 'yellow' ? 'bg-yellow-500' :
    color === 'red' ? 'bg-red-500' :
    color === 'purple' ? 'bg-purple-500' :
    color === 'indigo' ? 'bg-indigo-500' :
    'bg-indigo-500'
  );

  return (
    <div className="bg-white p-5 rounded-lg shadow-md flex items-center space-x-4">
      <div className={`rounded-full p-3 text-white ${resolvedColorClassName}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        {trend && (
          <p className={`mt-1 text-xs ${trendUp ? 'text-green-600' : 'text-gray-500'}`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};
