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
    <div class="email-template">
      <div class="email-badge">Special Approval</div>
      <h2>Special Approval Request</h2>
      <p class="email-greeting">Dear Motor Team,</p>
      <p class="email-text">
        Please provide special approval for the following customer details:
      </p>

      <table class="email-table">
        <tr><td>Customer Name</td><td>${customerName || "-"}</td></tr>
        <tr><td>Customer CPR / CR</td><td>${customerCPR || "-"}</td></tr>
        <tr><td>Plate No</td><td>${plateNo || "-"}</td></tr>
        <tr><td>Chassis No</td><td>${chassisNo || "-"}</td></tr>
        <tr><td>Start Date</td><td>${startDate || "-"}</td></tr>
        <tr><td>Expiry Date</td><td>${expiryDate || "-"}</td></tr>
        <tr><td>Government Type</td><td>${governmentType || "-"}</td></tr>
      </table>

      <p class="email-footer-text">
        Kindly review and advise at your earliest convenience.
      </p>

      <div class="email-signature">
        <p>Best regards,</p>
        <p><strong>MailGuard System</strong></p>
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
    <div class="email-template">
      <div class="email-badge">Issue New Policy</div>
      <h2>Issue New Policy Request</h2>
      <p class="email-greeting">Dear Motor Team,</p>
      <p class="email-text">
        Kindly issue a new policy for the following customer details:
      </p>

      <table class="email-table">
        <tr><td>Customer Name</td><td>${customerName || "-"}</td></tr>
        <tr><td>Customer CPR / CR</td><td>${customerCPR || "-"}</td></tr>
        <tr><td>Plate No</td><td>${plateNo || "-"}</td></tr>
        <tr><td>Chassis No</td><td>${chassisNo || "-"}</td></tr>
        <tr><td>Policy Start</td><td>${startDate || "-"}</td></tr>
        <tr><td>Policy Expiry</td><td>${expiryDate || "-"}</td></tr>
        <tr><td>Government Type</td><td>${governmentType || "-"}</td></tr>
      </table>

      <div class="email-signature">
        <p>Regards,</p>
        <p><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  changeIssuedCover: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
  }) => `
    <div class="email-template">
      <div class="email-badge">Change Issued Cover</div>
      <h2>Change Issued Cover Request</h2>
      <p class="email-greeting">Dear Motor Team,</p>
      <p class="email-text">
        Please amend the issued cover for the following details:
      </p>

      <table class="email-table">
        <tr><td>Customer Name</td><td>${customerName || "-"}</td></tr>
        <tr><td>Customer CPR / CR</td><td>${customerCPR || "-"}</td></tr>
        <tr><td>Plate No</td><td>${plateNo || "-"}</td></tr>
        <tr><td>Chassis No</td><td>${chassisNo || "-"}</td></tr>
      </table>

      <div class="email-signature">
        <p>Regards,</p>
        <p><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,

  policyTransfer: ({
    customerName,
    customerCPR,
    plateNo,
    chassisNo,
  }) => `
    <div class="email-template">
      <div class="email-badge">Policy Transfer</div>
      <h2>Policy Transfer Request</h2>
      <p class="email-greeting">Dear Motor Team,</p>
      <p class="email-text">
        Please process the policy transfer for the following details:
      </p>

      <table class="email-table">
        <tr><td>Customer Name</td><td>${customerName || "-"}</td></tr>
        <tr><td>Customer CPR / CR</td><td>${customerCPR || "-"}</td></tr>
        <tr><td>Plate No</td><td>${plateNo || "-"}</td></tr>
        <tr><td>Chassis No</td><td>${chassisNo || "-"}</td></tr>
      </table>

      <div class="email-signature">
        <p>Regards,</p>
        <p><strong>MailGuard System</strong></p>
      </div>
    </div>
  `,
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
  endorsementType   = '',   // 'endorsement' | 'cancellation'
  reason            = '',
  effectiveDate     = '',
} = {}) {
 
  const isCancel   = endorsementType === 'cancellation'
  const typeLabel  = isCancel ? 'Cancellation' : 'Endorsement'
  const badgeColor = isCancel ? '#fee2e2' : '#fef3c7'
  const badgeText  = isCancel ? '#991b1b'  : '#92400e'
  const nameLabel  = underCompanyName ? 'Company Name' : 'Customer Name'
 
  return `
<div class="email-template">
  <span class="email-badge" style="background:${badgeColor};color:${badgeText};">
    ${typeLabel} Request
  </span>
 
  <h2>Policy ${typeLabel}</h2>
 
  <p class="email-greeting">Dear Sir / Madam,</p>
 
  <p class="email-text">
    We kindly request the ${isCancel ? 'cancellation' : 'endorsement'} of the below-mentioned
    motor insurance policy${isCancel ? '' : ' as per the details provided'}.
    ${isCancel && reason ? `Reason for cancellation: <strong>${reason}</strong>.` : ''}
    Please process this at your earliest convenience and confirm accordingly.
  </p>
 
  <table class="email-table">
    <tr>
      <td>${nameLabel}</td>
      <td>${customerName || '—'}</td>
    </tr>
    <tr>
      <td>CPR / CR Number</td>
      <td>${customerCPR || '—'}</td>
    </tr>
    ${governmentType ? `
    <tr>
      <td>Government Type</td>
      <td>${governmentType}</td>
    </tr>` : ''}
    <tr>
      <td>Plate Number</td>
      <td>${plateNo || '—'}</td>
    </tr>
    <tr>
      <td>Chassis Number</td>
      <td>${chassisNo || '—'}</td>
    </tr>
    <tr>
      <td>Policy Start Date</td>
      <td>${startDate || '—'}</td>
    </tr>
    <tr>
      <td>Policy Expiry Date</td>
      <td>${expiryDate || '—'}</td>
    </tr>
    ${effectiveDate ? `
    <tr>
      <td>${typeLabel} Effective Date</td>
      <td>${effectiveDate}</td>
    </tr>` : ''}
    ${!isCancel && reason ? `
    <tr>
      <td>Endorsement Details</td>
      <td>${reason}</td>
    </tr>` : ''}
  </table>
 
  <p class="email-text">
    Kindly process the above request and revert with the updated
    ${isCancel ? 'cancellation confirmation' : 'endorsement certificate'} at your earliest convenience.
  </p>
 
  <p class="email-footer-text">
    Should you require any further information, please do not hesitate to contact us.
  </p>
 
  <div class="email-signature">
    <p>Best regards,</p>
    <p><strong>Towergate Insurance Services</strong></p>
    <p>Bahrain</p>
  </div>
</div>
  `.trim()
}