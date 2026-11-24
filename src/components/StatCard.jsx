import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function StatCard({ icon: Icon, label, value, change, tone = 'blue', note }) {
  const positive = !String(change).startsWith('-');
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}><Icon size={19} strokeWidth={2} /></div>
      <div className="stat-content">
        <p>{label}</p>
        <div className="stat-value-row"><strong>{value}</strong>{note && <span className="stat-note">{note}</span>}</div>
        {change && <div className={`stat-change ${positive ? 'change-positive' : 'change-negative'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{change}</span>
          <span className="change-caption">vs last week</span>
        </div>}
      </div>
    </article>
  );
}
