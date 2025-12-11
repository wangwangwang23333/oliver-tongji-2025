import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LabelList } from 'recharts';
import { CharacterStats } from '../types';

interface StatRadarProps {
  stats: CharacterStats;
}

const StatRadar: React.FC<StatRadarProps> = ({ stats }) => {
  const data = [
    { subject: 'Academic', A: stats.academic, fullMark: 100 },
    { subject: 'Research', A: stats.research, fullMark: 100 },
    { subject: 'Social', A: stats.social, fullMark: 100 },
    { subject: 'Mood', A: stats.mood, fullMark: 100 },
    { subject: 'Energy', A: stats.energy, fullMark: 100 },
    { subject: 'Money', A: stats.money, fullMark: 100 },
  ];

  return (
    <div className="w-full h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#cbd5e1" radialLines={false} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12 }} />
          {/* Show numeric ticks on the radial axis */}
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickCount={5} />
          <Radar
            name="Liang Qiao"
            dataKey="A"
            stroke="#2563eb"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.4}
            dot={{ stroke: '#1e40af', strokeWidth: 2, r: 3, fill: '#60a5fa' }}
          >
            {/* Show the numeric value near each vertex */}
            <LabelList dataKey="A" position="top" formatter={(value: any) => String(value)} />
          </Radar>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatRadar;
