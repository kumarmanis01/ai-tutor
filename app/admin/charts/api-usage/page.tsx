'use client';
import { useEffect, useState } from 'react';

interface SignupChartRow {
  period: string;
  count: number;
}

export default function UserSignupsChart() {
  const [data, setData] = useState<SignupChartRow[]>([]);

  useEffect(() => {
    fetch('/api/admin/charts/users')
      .then((res) => res.json())
      .then((data: SignupChartRow[]) => setData(data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <h1 className="text-2xl font-bold mb-4">User Signups Chart</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>Period</th>
            <th>Signups</th>
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
