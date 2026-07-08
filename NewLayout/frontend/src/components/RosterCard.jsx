import { getInitials, getWhatsAppLink, CLIENTS } from '../data/clients';
import { IconMail, IconPhone, IconSlack, IconCompose, IconWhatsApp } from './Icons';

export default function RosterCard({ person }) {
  const p = person;
  const ini = getInitials(p.name);
  const wa = getWhatsAppLink(p.phone);
  const load = CLIENTS.filter(c => c.csm1?.name === p.name || c.csm2?.name === p.name).length;

  return (
    <div className="roster-card">
      <div className="roster-top">
        <div className="avatar" style={{
          width: 42, height: 42, fontSize: 14,
          background: 'linear-gradient(135deg, var(--cobalt), #5A78F0)'
        }}>
          {ini}
        </div>
        <div>
          <div className="name">{p.name}</div>
          <div className="role">CSM member</div>
        </div>
        <span className="load-count">{load} accounts</span>
      </div>

      <div className="roster-meta">
        <div className={`meta-row ${p.email ? '' : 'blank'}`}>
          <IconMail /><span>{p.email || 'Blank'}</span>
        </div>
        <div className={`meta-row ${p.phone ? '' : 'blank'}`}>
          <IconPhone /><span>{p.phone || 'Blank'}</span>
        </div>
        <div className={`meta-row ${p.slack ? '' : 'blank'}`}>
          <IconSlack /><span>{p.slack || 'Not set'}</span>
        </div>
      </div>

      <div className="actions" style={{ paddingLeft: 0 }}>
        {p.email ? (
          <a className="action-btn email"
             href={`https://mail.google.com/mail/?view=cm&fs=1&to=${p.email}`}
             target="_blank" rel="noopener noreferrer">
            <IconCompose /> Compose
          </a>
        ) : (
          <span className="action-btn disabled"><IconCompose /> Compose</span>
        )}
        {p.slack ? (
          <a className="action-btn slack"
             href={`slack://user?team=T041B4BGT&id=${p.slack}`}>
            <IconSlack /> Slack
          </a>
        ) : (
          <span className="action-btn disabled"><IconSlack /> Slack</span>
        )}
        {wa ? (
          <a className="action-btn whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
            <IconWhatsApp /> WhatsApp
          </a>
        ) : (
          <span className="action-btn disabled"><IconWhatsApp /> WhatsApp</span>
        )}
      </div>
    </div>
  );
}
