import * as React from "react";
import { formatCurrency } from "@/lib/format";
import type { TemplateId } from "@/lib/types";
import type { InvoiceView } from "@/lib/view";
import {
  accent, AddressColumns, BizBlock, ItemsTable, MetaLines, NoteLines, SummaryTable,
} from "./parts";

function Minimal({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-minimal" style={accent(view.color)}>
      <div className="inv-header">
        <BizBlock view={view} />
        <div className="inv-header-right">
          <div className="inv-title">{L.invoice}</div>
          <div className="inv-number">{view.invNum}</div>
          <div className="inv-dates">
            {view.dateText}
            <br />
            {L.dueWord} {view.dueText}
          </div>
        </div>
      </div>
      <div className="inv-divider" />
      <div className="inv-addresses">
        <AddressColumns view={view} />
      </div>
      <div className="inv-items" role="table">
        <ItemsTable view={view} last={L.amount} />
      </div>
      <div className="inv-summary">
        <SummaryTable view={view} />
      </div>
      <div className="inv-footer">
        <div>
          <div className="inv-footer-label">{L.payment}</div>
          <div className="inv-footer-value">
            <MetaLines lines={view.payment} />
          </div>
        </div>
        {view.note && (
          <div>
            <div className="inv-footer-label">{L.note}</div>
            <div className="inv-footer-value">
              <NoteLines text={view.note} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bold({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-bold" style={accent(view.color)}>
      <div className="inv-header-band">
        <BizBlock view={view} />
        <div className="inv-title">{L.invoice}</div>
      </div>
      <div className="inv-header-sub">
        <div className="inv-number">{view.invNum}</div>
        <div className="inv-dates">
          {L.dateLabel} {view.dateText}
          <br />
          {L.dueLabel} {view.dueText}
        </div>
      </div>
      <div className="inv-addresses">
        <AddressColumns view={view} />
      </div>
      <div className="inv-items" role="table">
        <ItemsTable view={view} last={L.amount} />
      </div>
      <div className="inv-summary">
        <SummaryTable view={view} />
      </div>
      <div className="inv-footer">
        <div>
          <div className="inv-footer-label">{L.payment}</div>
          <div className="inv-footer-value">
            <MetaLines lines={view.payment} />
          </div>
        </div>
        {view.note && (
          <div>
            <div className="inv-footer-label">{L.note}</div>
            <div className="inv-footer-value">
              <NoteLines text={view.note} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Elegant({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-elegant" style={accent(view.color)}>
      <div className="inv-sidebar" />
      <div className="inv-body">
        <div className="inv-header">
          <BizBlock view={view} />
          <div className="inv-header-right">
            <div className="inv-title">{L.invoice}</div>
            <div className="inv-number">{view.invNum}</div>
            <div className="inv-dates">
              {L.dateLabel} {view.dateText}
              <br />
              {L.dueLabel} {view.dueText}
            </div>
          </div>
        </div>
        <div className="inv-addresses">
          <AddressColumns view={view} />
        </div>
        {/* Elegant was the one template calling ItemsTable bare. It now gets the
            same .inv-items wrapper as the others — purely so role="table" has a
            home (no .tpl-elegant .inv-items CSS rule exists, and .inv-body is a
            plain block, so nothing moves). */}
        <div className="inv-items" role="table">
          <ItemsTable view={view} last={L.amount} />
        </div>
        <div className="inv-summary">
          <SummaryTable view={view} />
        </div>
        <div className="inv-footer">
          <div>
            <div className="inv-footer-label">{L.payment}</div>
            <div className="inv-footer-value">
              <MetaLines lines={view.payment} />
            </div>
          </div>
          {view.note && (
            <div>
              <div className="inv-footer-label">{L.note}</div>
              <div className="inv-footer-value">
                <NoteLines text={view.note} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Retro({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-retro" style={accent(view.color)}>
      <div className="inv-header">
        <BizBlock view={view} />
        <div className="inv-title-block">
          <div className="inv-title">{L.invoice}</div>
        </div>
      </div>
      <div className="inv-meta-bar">
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.number}</div>
          <div className="inv-meta-value">{view.invNum}</div>
        </div>
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.dateShort}</div>
          <div className="inv-meta-value">{view.dateText}</div>
        </div>
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.dueShort}</div>
          <div className="inv-meta-value">{view.dueText}</div>
        </div>
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.total}</div>
          <div className="inv-meta-value">{formatCurrency(view.totals.total, view.currency)}</div>
        </div>
      </div>
      <div className="inv-addresses">
        <AddressColumns view={view} />
      </div>
      <div className="inv-items" role="table">
        <ItemsTable view={view} last={L.amount} />
      </div>
      <div className="inv-summary">
        <SummaryTable view={view} />
      </div>
      <div className="inv-footer">
        <div className="inv-footer-section">
          <div className="inv-footer-label">{L.paymentInfo}</div>
          <div className="inv-footer-value">
            <MetaLines lines={view.payment} />
          </div>
        </div>
        {view.note && (
          <div className="inv-footer-section">
            <div className="inv-footer-label">{L.note}</div>
            <div className="inv-footer-value">
              <NoteLines text={view.note} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Aurora({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-aurora" style={accent(view.color)}>
      <div className="inv-header-band">
        <div className="inv-header-left">
          <BizBlock view={view} />
        </div>
        <div className="inv-header-right">
          <div className="inv-title">{L.invoice}</div>
          <div className="inv-number">{view.invNum}</div>
        </div>
      </div>
      <div className="inv-meta-row">
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.dateShort}</div>
          <div className="inv-meta-value">{view.dateText}</div>
        </div>
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{L.dueShort}</div>
          <div className="inv-meta-value">{view.dueText}</div>
        </div>
        <div className="inv-meta-cell inv-meta-total">
          <div className="inv-meta-label">{L.total}</div>
          <div className="inv-meta-value">{formatCurrency(view.totals.total, view.currency)}</div>
        </div>
      </div>
      <div className="inv-addresses">
        <AddressColumns view={view} />
      </div>
      <div className="inv-items" role="table">
        <ItemsTable view={view} last={L.amount} />
      </div>
      <div className="inv-summary">
        <SummaryTable view={view} />
      </div>
      <div className="inv-footer">
        <div>
          <div className="inv-footer-label">{L.payment}</div>
          <div className="inv-footer-value">
            <MetaLines lines={view.payment} />
          </div>
        </div>
        {view.note && (
          <div>
            <div className="inv-footer-label">{L.note}</div>
            <div className="inv-footer-value">
              <NoteLines text={view.note} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Mono({ view }: { view: InvoiceView }) {
  const L = view.labels;
  return (
    <div className="tpl-mono" style={accent(view.color)}>
      <div className="inv-header">
        <BizBlock view={view} />
        <div className="inv-header-right">
          <div className="inv-title">{L.invoice}</div>
          <div className="inv-number">{view.invNum}</div>
          <div className="inv-dates">
            {L.dateLabel} {view.dateText}
            <br />
            {L.dueLabel} {view.dueText}
          </div>
        </div>
      </div>
      <div className="inv-rule" />
      <div className="inv-addresses">
        <AddressColumns view={view} />
      </div>
      <div className="inv-items" role="table">
        <ItemsTable view={view} last={L.amount} />
      </div>
      <div className="inv-summary">
        <SummaryTable view={view} />
      </div>
      <div className="inv-footer">
        <div>
          <div className="inv-footer-label">{L.payment}</div>
          <div className="inv-footer-value">
            <MetaLines lines={view.payment} />
          </div>
        </div>
        {view.note && (
          <div>
            <div className="inv-footer-label">{L.note}</div>
            <div className="inv-footer-value">
              <NoteLines text={view.note} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MAP: Record<TemplateId, React.FC<{ view: InvoiceView }>> = {
  minimal: Minimal,
  bold: Bold,
  elegant: Elegant,
  retro: Retro,
  aurora: Aurora,
  mono: Mono,
};

export function InvoiceTemplate({ template, view }: { template: TemplateId; view: InvoiceView }) {
  const Cmp = MAP[template];
  return <Cmp view={view} />;
}
