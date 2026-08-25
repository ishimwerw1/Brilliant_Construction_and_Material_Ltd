import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

export const PALETTE = ['#0d3b66', '#1a6fb5', '#1e7e46', '#f9a825', '#c0392b', '#6f42c1', '#20c997', '#fd7e14']

const baseOptions = (horizontal = false) => ({
  responsive: true,
  indexAxis: horizontal ? 'y' : 'x',
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true }, x: { beginAtZero: true } }
})

export const barChart = (labels, data, label = 'Value') => ({
  data: {
    labels,
    datasets: [{ label, data, backgroundColor: PALETTE[0], borderRadius: 4 }]
  },
  options: baseOptions()
})

export const lineChart = (labels, datasets) => ({
  data: { labels, datasets },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true } }
  }
})

export const doughnutChart = (labels, data) => ({
  data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderWidth: 0 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
})

export function Chart({ type, ...props }) {
  if (type === 'bar') return <Bar {...props} />
  if (type === 'line') return <Line {...props} />
  return <Doughnut {...props} />
}

export default Chart
