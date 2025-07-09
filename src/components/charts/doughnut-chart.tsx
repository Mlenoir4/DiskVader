import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DoughnutChartData {
  name: string;
  value: number;
  color: string;
}

interface CustomDoughnutChartProps {
  data: DoughnutChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerText?: string;
  centerSubText?: string;
  formatValue?: (value: number, payload?: any) => string;
}

const CustomDoughnutChart = ({ 
  data, 
  height = 320, 
  innerRadius = 60, 
  outerRadius = 100,
  centerText,
  centerSubText,
  formatValue
}: CustomDoughnutChartProps) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const displayValue = formatValue ? formatValue(data.value, data) : `${data.value.toFixed(1)} GB`;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">{displayValue}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{centerText}</div>
            {centerSubText && <div className="text-sm text-gray-600">{centerSubText}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDoughnutChart;
