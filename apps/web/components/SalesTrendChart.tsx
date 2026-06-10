'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { SalesTrendPoint } from '@/lib/dashboard';
import { formatRupiah } from '@/lib/format';

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { weekday: 'short' });
}

export default function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const chartData = data.map((p) => ({ ...p, label: shortDate(p.date) }));
  const max = Math.max(1, ...chartData.map((d) => d.revenue));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#eef4ee" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6d7a72' }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#6d7a72' }}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}rb` : String(v))}
          width={48}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,105,72,0.06)' }}
          formatter={(value) => [formatRupiah(Number(value)), 'Omzet']}
          labelStyle={{ color: '#171d19', fontWeight: 600 }}
          contentStyle={{ borderRadius: 12, border: '1px solid #bccac0', fontSize: 13 }}
        />
        <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
          {chartData.map((d, i) => {
            // Darker green for higher bars, lighter for lower — visual depth
            const ratio = d.revenue / max;
            const color = ratio > 0.66 ? '#006948' : ratio > 0.33 ? '#4f9e7f' : '#a7cdbb';
            return <Cell key={i} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
