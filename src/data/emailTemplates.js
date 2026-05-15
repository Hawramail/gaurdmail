// Shared inline style tokens — mirrors the :deep() CSS in IndexPage.vue exactly
const S = {
  wrap:     'font-family:"Segoe UI",Arial,sans-serif;max-width:600px;margin:0 auto;padding:22px;background:#ffffff;color:#1e293b;border:1px solid #dbe7ff;border-radius:14px;box-shadow:0 8px 24px rgba(37,99,235,0.06)',
  // badge: same blue gradient for all templates, matching the :deep() override
  badge:    'display:inline-block;background-color:#dbeafe;background-image:linear-gradient(135deg,#eff6ff,#dbeafe);color:#1d4ed8;font-size:11px;font-weight:700;padding:6px 10px;border-radius:999px;margin-bottom:12px;letter-spacing:0.3px;text-transform:uppercase',
  h2:       'font-size:24px;font-weight:700;margin:0 0 14px;color:#0f172a',
  greeting: 'font-size:15px;font-weight:600;color:#1e3a8a;margin:0 0 10px',
  // :deep() applies identical rules to both .email-text and .email-footer-text
  text:     'font-size:14px;line-height:1.8;color:#334155;margin:0 0 16px',
  footer:   'font-size:14px;line-height:1.8;color:#334155;margin:0 0 16px',
  table:    'width:100%;border-collapse:collapse;margin:18px 0;border:1px solid #dbeafe',
  tdL:      'padding:12px 14px;border:1px solid #e2e8f0;background:#eff6ff;font-weight:700;width:32%;color:#1e3a8a;font-size:13px;vertical-align:top',
  tdO:      'padding:12px 14px;border:1px solid #e2e8f0;background:#f8fbff;font-size:13px;vertical-align:top',
  tdE:      'padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;font-size:13px;vertical-align:top',
  sig:      'margin-top:26px;padding-top:14px;border-top:1px dashed #cbd5e1;font-size:14px;color:#334155',
};

export const emailTemplates = {
  specialApproval: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
    startDate,
    expiryDate,
    governmentType,
  }) => `
    <div class="email-template" style="${S.wrap}">
      <div class="email-badge" style="${S.badge}">Special Approval</div>
      <h2 style="${S.h2}">Special Approval Request</h2>
      <p class="email-greeting" style="${S.greeting}">Dear Motor Team,</p>
      <p class="email-text" style="${S.text}">
        Please provide special approval for the following customer details:
      </p>

      <table class="email-table" style="${S.table}">
        <tr><td style="${S.tdL}">Customer Name</td><td style="${S.tdO}">${customerName || "-"}</td></tr>
        <tr><td style="${S.tdL}">Customer CPR / CR</td><td style="${S.tdE}">${customerCPR || "-"}</td></tr>
        <tr><td style="${S.tdL}">Plate No</td><td style="${S.tdO}">${plateNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Chassis No</td><td style="${S.tdE}">${chassisNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Start Date</td><td style="${S.tdO}">${startDate || "-"}</td></tr>
        <tr><td style="${S.tdL}">Expiry Date</td><td style="${S.tdE}">${expiryDate || "-"}</td></tr>
        <tr><td style="${S.tdL}">Government Type</td><td style="${S.tdO}">${governmentType || "-"}</td></tr>
      </table>

      <p class="email-footer-text" style="${S.footer}">
        Kindly review and advise at your earliest convenience.
      </p>

      <div class="email-signature" style="${S.sig}">
        <p style="margin:4px 0">Best regards,</p>
        <p style="margin:4px 0"><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  issueNewPolicy: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
    startDate,
    expiryDate,
    governmentType,
  }) => `
    <div class="email-template" style="${S.wrap}">
      <div class="email-badge" style="${S.badge}">Issue New Policy</div>
      <h2 style="${S.h2}">Issue New Policy Request</h2>
      <p class="email-greeting" style="${S.greeting}">Dear Motor Team,</p>
      <p class="email-text" style="${S.text}">
        Kindly issue a new policy for the following customer details:
      </p>

      <table class="email-table" style="${S.table}">
        <tr><td style="${S.tdL}">Customer Name</td><td style="${S.tdO}">${customerName || "-"}</td></tr>
        <tr><td style="${S.tdL}">Customer CPR / CR</td><td style="${S.tdE}">${customerCPR || "-"}</td></tr>
        <tr><td style="${S.tdL}">Plate No</td><td style="${S.tdO}">${plateNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Chassis No</td><td style="${S.tdE}">${chassisNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Policy Start</td><td style="${S.tdO}">${startDate || "-"}</td></tr>
        <tr><td style="${S.tdL}">Policy Expiry</td><td style="${S.tdE}">${expiryDate || "-"}</td></tr>
        <tr><td style="${S.tdL}">Government Type</td><td style="${S.tdO}">${governmentType || "-"}</td></tr>
      </table>

      <div class="email-signature" style="${S.sig}">
        <p style="margin:4px 0">Regards,</p>
        <p style="margin:4px 0"><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  changeIssuedCover: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
  }) => `
    <div class="email-template" style="${S.wrap}">
      <div class="email-badge" style="${S.badge}">Change Issued Cover</div>
      <h2 style="${S.h2}">Change Issued Cover Request</h2>
      <p class="email-greeting" style="${S.greeting}">Dear Motor Team,</p>
      <p class="email-text" style="${S.text}">
        Please amend the issued cover for the following details:
      </p>

      <table class="email-table" style="${S.table}">
        <tr><td style="${S.tdL}">Customer Name</td><td style="${S.tdO}">${customerName || "-"}</td></tr>
        <tr><td style="${S.tdL}">Customer CPR / CR</td><td style="${S.tdE}">${customerCPR || "-"}</td></tr>
        <tr><td style="${S.tdL}">Plate No</td><td style="${S.tdO}">${plateNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Chassis No</td><td style="${S.tdE}">${chassisNo || "-"}</td></tr>
      </table>

      <div class="email-signature" style="${S.sig}">
        <p style="margin:4px 0">Regards,</p>
        <p style="margin:4px 0"><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  policyTransfer: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
  }) => `
    <div class="email-template" style="${S.wrap}">
      <div class="email-badge" style="${S.badge}">Policy Transfer</div>
      <h2 style="${S.h2}">Policy Transfer Request</h2>
      <p class="email-greeting" style="${S.greeting}">Dear Motor Team,</p>
      <p class="email-text" style="${S.text}">
        Please process the policy transfer for the following details:
      </p>

      <table class="email-table" style="${S.table}">
        <tr><td style="${S.tdL}">Customer Name</td><td style="${S.tdO}">${customerName || "-"}</td></tr>
        <tr><td style="${S.tdL}">Customer CPR / CR</td><td style="${S.tdE}">${customerCPR || "-"}</td></tr>
        <tr><td style="${S.tdL}">Plate No</td><td style="${S.tdO}">${plateNo || "-"}</td></tr>
        <tr><td style="${S.tdL}">Chassis No</td><td style="${S.tdE}">${chassisNo || "-"}</td></tr>
      </table>

      <div class="email-signature" style="${S.sig}">
        <p style="margin:4px 0">Regards,</p>
        <p style="margin:4px 0"><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  endorsementCancellation: (args) => endorsementCancellation(args),
};

export function endorsementCancellation ({
  customerName      = '',
  customerCPR       = '',
  plateNo           = '',
  chassisNo         = '',
  startDate         = '',
  expiryDate        = '',
  governmentType    = '',
  underCompanyName  = false,
  endorsementType   = '',
  reason            = '',
  effectiveDate     = '',
} = {}) {

  const isCancel   = endorsementType === 'cancellation'
  const typeLabel  = isCancel ? 'Cancellation' : 'Endorsement'
  const nameLabel  = underCompanyName ? 'Company Name' : 'Customer Name'

  // Build rows array so we can alternate odd/even value cell backgrounds
  const rows = [
    [nameLabel,        customerName  || '—'],
    ['CPR / CR Number', customerCPR  || '—'],
    ...(governmentType ? [['Government Type', governmentType]] : []),
    ['Plate Number',    plateNo      || '—'],
    ['Chassis Number',  chassisNo    || '—'],
    ['Policy Start Date', startDate  || '—'],
    ['Policy Expiry Date', expiryDate || '—'],
    ...(effectiveDate ? [[`${typeLabel} Effective Date`, effectiveDate]] : []),
    ...(!isCancel && reason ? [['Endorsement Details', reason]] : []),
  ]

  const tableRows = rows.map(([label, value], i) => `
    <tr>
      <td style="${S.tdL}">${label}</td>
      <td style="${i % 2 === 0 ? S.tdO : S.tdE}">${value}</td>
    </tr>`).join('')

  return `
<div class="email-template" style="${S.wrap}">
  <span class="email-badge" style="${S.badge}">
    ${typeLabel} Request
  </span>

  <h2 style="${S.h2}">Policy ${typeLabel}</h2>

  <p class="email-greeting" style="${S.greeting}">Dear Sir / Madam,</p>

  <p class="email-text" style="${S.text}">
    We kindly request the ${isCancel ? 'cancellation' : 'endorsement'} of the below-mentioned
    motor insurance policy${isCancel ? '' : ' as per the details provided'}.
    ${isCancel && reason ? `Reason for cancellation: <strong>${reason}</strong>.` : ''}
    Please process this at your earliest convenience and confirm accordingly.
  </p>

  <table class="email-table" style="${S.table}">
    ${tableRows}
  </table>

  <p class="email-text" style="${S.text}">
    Kindly process the above request and revert with the updated
    ${isCancel ? 'cancellation confirmation' : 'endorsement certificate'} at your earliest convenience.
  </p>

  <p class="email-footer-text" style="${S.footer}">
    Should you require any further information, please do not hesitate to contact us.
  </p>

  <div class="email-signature" style="${S.sig}">
    <p style="margin:4px 0">Best regards,</p>
    <p style="margin:4px 0"><strong>Towergate Insurance Services</strong></p>
    <p style="margin:4px 0">Bahrain</p>
  </div>
</div>
  `.trim()
}
