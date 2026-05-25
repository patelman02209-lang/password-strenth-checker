import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** Decorative throughput-style spark for the dashboard header (sample series). */
const SAMPLE = Array.from({ length: 14 }, (_, i) => ({
  t: `T${i + 1}`,
  score: 20 + ((i * 7) % 23) + (i % 4) * 5,
}))

export function ActivityBandChart() {
  return (
    <div className="h-28 w-full min-w-[200px] sm:h-32">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 112 }}>
        <AreaChart data={SAMPLE} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="pscArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={['dataMin - 4', 'dataMax + 8']} />
          <Tooltip
            contentStyle={{
              background: 'rgba(9,9,11,0.92)',
              border: '1px solid rgba(63,63,70,0.6)',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#pscArea)"
            name="Activity"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
