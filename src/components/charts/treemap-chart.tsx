import React from 'react';

interface TreeMapDataItem {
  name: string;
  value: number;
  color: string;
}

interface TreeMapChartProps {
  data: TreeMapDataItem[];
  height?: number;
  width?: string;
}

const TreeMapChart: React.FC<TreeMapChartProps> = ({ 
  data = [], 
  height = 320,
  width = "100%" 
}) => {
  // Calculate total value for percentage calculations
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate relative sizes for treemap layout
  const processedData = data.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
    // Calculate dimensions based on percentage
    area: (item.value / totalValue) * (height * 400) // Assuming 400px width base
  }));

  // Simple treemap layout algorithm - arrange rectangles in rows
  const layoutItems = () => {
    const items = [...processedData].sort((a, b) => b.value - a.value);
    const containerWidth = 400; // Base container width
    const containerHeight = height;
    
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const padding = 3;
    
    return items.map((item, index) => {
      // Calculate width and height based on area - improved algorithm
      const area = (item.percentage / 100) * containerWidth * containerHeight;
      let itemWidth, itemHeight;
      
      // For larger items, use wider rectangles
      if (item.percentage > 30) {
        itemWidth = Math.min(containerWidth * 0.6, Math.sqrt(area * 2));
        itemHeight = area / itemWidth;
      } else if (item.percentage > 15) {
        itemWidth = Math.min(containerWidth * 0.4, Math.sqrt(area * 1.5));
        itemHeight = area / itemWidth;
      } else {
        itemWidth = Math.sqrt(area);
        itemHeight = area / itemWidth;
      }
      
      // Adjust for container constraints
      if (currentX + itemWidth > containerWidth) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }
      
      // Ensure minimum and maximum sizes
      itemWidth = Math.max(Math.min(itemWidth, containerWidth - currentX - padding), 50);
      itemHeight = Math.max(Math.min(itemHeight, containerHeight - currentY - padding), 30);
      
      const rect = {
        x: currentX + padding / 2,
        y: currentY + padding / 2,
        width: itemWidth - padding,
        height: itemHeight - padding,
        ...item
      };
      
      currentX += itemWidth;
      rowHeight = Math.max(rowHeight, itemHeight);
      
      return rect;
    });
  };

  const layoutedItems = layoutItems();

  const formatSize = (bytes: number) => {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(1) + ' GB';
    } else if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(1) + ' MB';
    } else if (bytes >= 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  };

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 400 320"
        className="w-full h-full"
      >
        {layoutedItems.map((item, index) => (
          <g key={index}>
            <rect
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              fill={item.color}
              stroke="#ffffff"
              strokeWidth="2"
              rx="6"
              className="transition-all duration-300 hover:opacity-90 cursor-pointer"
              style={{
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))'
              }}
            />
            {/* Text labels - improved readability */}
            {item.width > 90 && item.height > 60 && (
              <>
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 - 12}
                  textAnchor="middle"
                  className="text-sm font-bold fill-white"
                  style={{ fontSize: '12px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {item.name}
                </text>
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 + 2}
                  textAnchor="middle"
                  className="text-xs fill-white opacity-95"
                  style={{ fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {formatSize(item.value)}
                </text>
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 + 16}
                  textAnchor="middle"
                  className="text-xs fill-white opacity-85 font-medium"
                  style={{ fontSize: '9px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {item.percentage.toFixed(1)}%
                </text>
              </>
            )}
            {/* Medium rectangles */}
            {item.width > 60 && item.height > 40 && item.width <= 90 && (
              <>
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 - 4}
                  textAnchor="middle"
                  className="text-xs font-semibold fill-white"
                  style={{ fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name}
                </text>
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2 + 8}
                  textAnchor="middle"
                  className="text-xs fill-white opacity-90"
                  style={{ fontSize: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {item.percentage.toFixed(1)}%
                </text>
              </>
            )}
            {/* Small rectangles */}
            {item.width > 40 && item.height > 25 && item.width <= 60 && (
              <text
                x={item.x + item.width / 2}
                y={item.y + item.height / 2}
                textAnchor="middle"
                className="text-xs font-semibold fill-white"
                style={{ fontSize: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                {item.name.length > 6 ? item.name.substring(0, 6) + '...' : item.name}
              </text>
            )}
          </g>
        ))}
      </svg>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {processedData.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-gray-600">
              {item.name} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreeMapChart;
