import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { redirect } from 'next/navigation'

function statusColor(cps: number) {
  if (cps < 0.003) return 'text-green-600'
  if (cps <= 0.005) return 'text-amber-600'
  return 'text-red-600'
}

export default async function CostsPage() {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') redirect('/login')

  const metrics = await prisma.dailyCostMetric.findMany({
    orderBy: { date: 'desc' },
    take: 30,
  })

  const total30CostUsd = metrics.reduce((s, m) => s + m.totalCostUsd, 0)
  const total30Sessions = metrics.reduce((s, m) => s + m.sessions, 0)
  const avg30Cps = total30Sessions > 0 ? total30CostUsd / total30Sessions : 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">AI Cost Metrics (last 30 days)</h1>
      {!metrics.length ? (
        <p className="text-gray-400">No cost data yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b-2 border-gray-200 text-gray-500 text-xs uppercase">
              <th className="pb-2 pr-6 font-medium">Date</th>
              <th className="pb-2 pr-6 font-medium">Sessions</th>
              <th className="pb-2 pr-6 font-medium">Total Cost USD</th>
              <th className="pb-2 pr-6 font-medium">Cost / Session</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const cps = m.costPerSession
              const color = statusColor(cps)
              return (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-6 font-mono text-xs">{m.date.toISOString().slice(0, 10)}</td>
                  <td className="py-2 pr-6">{m.sessions.toLocaleString()}</td>
                  <td className="py-2 pr-6">${m.totalCostUsd.toFixed(4)}</td>
                  <td className="py-2 pr-6">${cps.toFixed(5)}</td>
                  <td className={`py-2 font-medium text-xs ${color}`}>
                    {cps < 0.003 ? '✓ OK' : cps <= 0.005 ? '⚠ warn' : '⛔ alert'}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="py-2 pr-6 text-xs">30-day total</td>
              <td className="py-2 pr-6">{total30Sessions.toLocaleString()}</td>
              <td className="py-2 pr-6">${total30CostUsd.toFixed(4)}</td>
              <td className={`py-2 pr-6 ${statusColor(avg30Cps)}`}>${avg30Cps.toFixed(5)}</td>
              <td className="py-2" />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
