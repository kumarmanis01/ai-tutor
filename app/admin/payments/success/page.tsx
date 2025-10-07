'use client';
import { useEffect, useState } from 'react';

interface Payment {
  id: string;
  user?: { email?: string };
  amount: number;
  provider?: string;
  createdAt: string;
}

export default function SuccessfulPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    fetch('/api/admin/payments/success')
      .then((res) => res.json())
      .then((data: Payment[]) => setPayments(data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <h1 className="text-2xl font-bold mb-4">Successful Payments</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>User</th>
            <th>Amount</th>
            <th>Provider</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.user?.email || 'Unknown'}</td>
              <td>${p.amount}</td>
              <td>{p.provider}</td>
              <td>{new Date(p.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
