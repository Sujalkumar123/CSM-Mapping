import { getInitials, getWhatsAppLink } from '../data/clients';
import { IconMail, IconPhone, IconSlack, IconCompose, IconWhatsApp } from './Icons';

export default function ContactBlock({ roleLabel, person, kind }) {
  if (!person || !person.name) {
    return (
      <div className={`contact ${kind} empty`}>
        No {roleLabel.toLowerCase()} assigned
      </div>
    );
  }

  const ini = getInitials(person.name);
  const wa = getWhatsAppLink(person.phone);

  return (
    <div className={`contact ${kind}`}>
      <div className="contact-top">
        <div className="avatar">{ini}</div>
        <div>
          <div className="contact-role">{roleLabel}</div>
          <div className="contact-name">{person.name}</div>
        </div>
      </div>

      <div className="contact-meta">
        {person.email ? (
          <div className="meta-row"><IconMail /><span>{person.email}</span></div>
        ) : (
          <div className="meta-row blank"><IconMail /><span>Blank</span></div>
        )}
        {person.phone ? (
          <div className="meta-row"><IconPhone /><span>{person.phone}</span></div>
        ) : (
          <div className="meta-row blank"><IconPhone /><span>Blank</span></div>
        )}
      </div>

      <div className="actions">
        {person.email ? (
          <a className="action-btn email"
             href={`https://mail.google.com/mail/?view=cm&fs=1&to=${person.email}`}
             target="_blank" rel="noopener noreferrer">
            <IconCompose /> Compose
          </a>
        ) : (
          <span className="action-btn disabled"><IconCompose /> Compose</span>
        )}

        {kind !== 'lead' && (
          person.slack ? (
            <a className="action-btn slack"
               href={`slack://user?team=T041B4BGT&id=${person.slack}`}>
              <IconSlack /> Slack
            </a>
          ) : (
            <span className="action-btn disabled"><IconSlack /> Slack</span>
          )
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
