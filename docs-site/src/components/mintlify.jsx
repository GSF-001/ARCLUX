import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';

function isExternal(href) {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');
}

function glyph(text) {
  const clean = String(text || '?').replace(/[^A-Za-z0-9]/g, '');
  return (clean.charAt(0) || '?').toUpperCase();
}

export function Card({ title, icon, href, children, className }) {
  const body = (
    <>
      <span className="mx-card__glyph" aria-hidden="true" data-icon={icon || ''}>
        {glyph(title)}
      </span>
      <span className="mx-card__title">{title}</span>
      <div className="mx-card__body">{children}</div>
    </>
  );

  if (!href) {
    return <div className={clsx('mx-card', className)}>{body}</div>;
  }

  const External = isExternal(href);
  const Tag = External ? 'a' : Link;
  const props = External ? { href, target: '_blank', rel: 'noreferrer' } : { to: href };

  return (
    <Tag className={clsx('mx-card', 'mx-card--link', className)} {...props}>
      {body}
    </Tag>
  );
}

export function CardGroup({ cols = 2, children, className }) {
  return (
    <div className={clsx('mx-cardgroup', className)} style={{ '--mx-cols': Number(cols) || 2 }}>
      {children}
    </div>
  );
}

const ADMON_LABELS = {
  note: 'Note',
  info: 'Info',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
  caution: 'Caution',
};

function Admon({ kind, children }) {
  return (
    <div className={clsx('mx-admon', `mx-admon--${kind}`)}>
      <span className="mx-admon__label">{ADMON_LABELS[kind] || kind}</span>
      <div className="mx-admon__content">{children}</div>
    </div>
  );
}

export const Note = (p) => <Admon kind="note" {...p} />;
export const Info = (p) => <Admon kind="info" {...p} />;
export const Tip = (p) => <Admon kind="tip" {...p} />;
export const Warning = (p) => <Admon kind="warning" {...p} />;
export const Danger = (p) => <Admon kind="danger" {...p} />;
export const Caution = (p) => <Admon kind="caution" {...p} />;

export function Accordion({ title, icon, children, defaultOpen = false }) {
  return (
    <details className="mx-accordion" open={defaultOpen || undefined}>
      <summary>
        <span className="mx-accordion__glyph" aria-hidden="true" data-icon={icon || ''}>
          {glyph(title)}
        </span>
        <span>{title}</span>
      </summary>
      <div className="mx-accordion__body">{children}</div>
    </details>
  );
}

export function AccordionGroup({ children, className }) {
  return <div className={clsx('mx-accordiongroup', className)}>{children}</div>;
}

export function Steps({ children, className }) {
  return <div className={clsx('mx-steps', className)}>{children}</div>;
}

export function Step({ title, children }) {
  return (
    <div className="mx-step">
      <div className="mx-step__title">{title}</div>
      <div className="mx-step__body">{children}</div>
    </div>
  );
}

export function Tabs({ children, className }) {
  return <div className={clsx('mx-tabs', className)}>{children}</div>;
}

export function Tab({ label, children }) {
  return (
    <div className="mx-tab">
      <div className="mx-tab__label">{label}</div>
      <div className="mx-tab__body">{children}</div>
    </div>
  );
}

export function CodeGroup({ children, className }) {
  return <div className={clsx('mx-codegroup', className)}>{children}</div>;
}
