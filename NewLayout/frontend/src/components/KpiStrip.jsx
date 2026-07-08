import { getBarsData } from '../data/clients';
import { IconClients, IconPerson, IconPhone, IconMail } from './Icons';

export default function KpiStrip({ activeKpi, onKpiClick, clientsList = [], csmNames = [] }) {
  const totalClients = clientsList.length;
  const totalCsm = csmNames.length;
  const missingPhone = clientsList.filter(c => c.csm1?.name && !c.csm1.phone).length;
  const missingEmail = clientsList.filter(c => c.csm1?.name && !c.csm1.email).length;
  const maxKpi = Math.max(totalClients, totalCsm, missingPhone, missingEmail, 1);

  const kpis = [
    { key: 'clients', title: 'Total clients', value: totalClients, icon: <IconClients size={14} stroke="var(--cobalt)" strokeWidth="2.2" /> },
    { key: 'csm', title: 'Total CSMs', value: totalCsm, icon: <IconPerson size={14} stroke="var(--violet)" strokeWidth="2.2" /> },
    { key: 'phone', title: 'Missing phone', value: missingPhone, icon: <IconPhone size={14} stroke="var(--amber)" strokeWidth="2.2" /> },
    { key: 'email', title: 'Missing email', value: missingEmail, icon: <IconMail size={14} stroke="var(--rose)" strokeWidth="2.2" /> },
  ];

  return (
    <div className="kpi-strip">
      {kpis.map(kpi => {
        const bars = getBarsData(kpi.value, maxKpi);
        return (
          <div
            key={kpi.key}
            className={`kpi ${activeKpi === kpi.key ? 'active' : ''}`}
            data-key={kpi.key}
            onClick={() => onKpiClick(kpi.key)}
          >
            <div className="kpi-top">
              <span className="kpi-title">{kpi.title}</span>
              <span className="kpi-icon">{kpi.icon}</span>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-bars">
              {bars.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
