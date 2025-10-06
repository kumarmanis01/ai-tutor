'use client';
import { useEffect, useState } from 'react';

interface UsageChartRow {
  period: string;
  count: number;
}

export default function ApiUsageChart() {
  const [data, setData] = useState<UsageChartRow[]>([]);

  useEffect(() => {
    fetch('/api/admin/charts/api-usage')
      .then((res) => res.json())
      .then((data: UsageChartRow[]) => setData(data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <h1 className="text-2xl font-bold mb-4">API Usage Chart</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>Period</th>
            <th>API Calls</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.period}>
              <td>{row.period}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
