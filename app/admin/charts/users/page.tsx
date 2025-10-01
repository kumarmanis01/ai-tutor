'use client';
import { useEffect, useState } from 'react';

export default function UserSignupsChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/admin/charts/users')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <h1 className="text-2xl font-bold mb-4">User Signups Chart</h1>
      {/* Replace this with a chart library for visualization */}
      <table className="w-full border">
        <thead>
          <tr>
            <th>Period</th>
            <th>Signups</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
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
