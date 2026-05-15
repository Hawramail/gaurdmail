// Demo scenarios for the SIEM attack simulator.
// Each entry writes one security_event and (if high/critical) one alert.
// All sim events are marked with anomalyRuleTriggered so they can be
// identified and cleared separately from real production events.

export const simulationScenarios = [
  {
    eventType:  'EMAIL_SENT',
    userId:     'sim-user',
    metadata:   { message: 'Burst: 11 emails in 6 minutes' },
    severity:   'critical',
    rule:       'email_burst',
    burstCount: 11,   // write 11 separate docs so DetectAnomalies.php document-count query fires
  },
  {
    eventType: 'FILE_REJECTED',
    userId:    'unknown.user',
    metadata:  { filename: 'payload.exe', reason: 'Executable disguised as PDF' },
    severity:  'critical',
    rule:      'repeated_file_rejections',
  },
  {
    eventType: 'ADMIN_CONFIG_CHANGED',
    userId:    'unknown.user',
    metadata:  { field: 'TO address', company: 'GIG Gulf', message: '3 config changes in 5 min' },
    severity:  'high',
    rule:      'admin_config_tampering',
  },
  {
    eventType: 'EMAIL_SENT',
    userId:    'sim-user',
    metadata:  { message: 'Email sent at 02:34 AM Bahrain time' },
    severity:  'high',
    rule:      'unusual_send_time',
  },
  {
    eventType: 'ZOHO_TOKEN_FAILURE',
    userId:    'system',
    metadata:  { attempts: 4, message: '4 consecutive Zoho auth failures' },
    severity:  'medium',
    rule:      'zoho_token_failure_spike',
  },
  {
    eventType: 'FILE_UPLOAD',
    userId:    'staff.user',
    metadata:  { filename: 'large_pack.pdf', totalSizeBytes: 16800000, sizeMB: 16.0, message: '16 MB upload' },
    severity:  'medium',
    rule:      'large_file_upload',
  },
]
