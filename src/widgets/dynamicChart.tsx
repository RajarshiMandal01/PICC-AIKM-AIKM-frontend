import { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from 'chart.js';
import { Line, Pie, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "Century Gothic";
ChartJS.defaults.color = "black";
ChartJS.defaults.font.size = 16;

type ChartType = 'line' | 'area' | 'pie' | 'donut' | 'bar' | 'smooth-line' | 'smooth-area';

interface Dataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  fill?: boolean;
}

export interface DynamicChartProps {
  chartType: ChartType;
  labels: string[];
  datasets: Dataset[];
  title?: string | string[];
}

export default function DynamicChart({
  chartType,
  labels,
  datasets,
  title,
}: DynamicChartProps) {
  const chartRef = useRef<any>(null);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, position: 'top' as const },
      title: {
        display: !!title,
        text: Array.isArray(title) ? title.join('\n') : title,
      },
    },
  };

  const data = {
    labels,
    datasets: datasets.map(ds => {
      // For area or smooth-area charts, ensure fill and background color
      if (chartType === 'area' || chartType === 'smooth-area') {
        return {
          ...ds,
          fill: true,
          tension: chartType === 'smooth-area' ? 0.4 : 0,
          backgroundColor:
            ds.backgroundColor ||
            (typeof ds.borderColor === 'string'
              ? ds.borderColor.replace('rgb', 'rgba').replace(')', ', 0.3)')
              : undefined),
        };
      }
      return ds;
    }),
  };

  useEffect(() => {
    // Re-render chart on prop changes
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [labels, datasets, chartType, title]);

  return (
    <div className="w-full h-full flex-none overflow-hidden">
      {chartType === 'line' || chartType === 'area' || chartType === 'smooth-area' ? (
        <Line ref={chartRef} options={options} data={data} />
      ) : chartType === 'bar' ? (
        <Bar ref={chartRef} options={options} data={data} />
      ) : chartType === 'pie' ? (
        <Pie ref={chartRef} options={options} data={data} />
      ) : chartType === 'donut' ? (
        <Doughnut ref={chartRef} options={options} data={data} />
      ) : null}
    </div>
  );
}
