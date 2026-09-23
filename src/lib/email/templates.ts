interface DigestData {
  userName: string;
  userEmail: string;
  scansThisWeek: number;
  scansThisMonth: number;
  remainingScans: number;
  tier: 'free' | 'pro' | 'team';
  recentFindings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topIssues: Array<{
    title: string;
    severity: string;
    fileName: string;
  }>;
  unsubscribeUrl: string;
  dashboardUrl: string;
}

export function generateDigestHtml(data: DigestData): string {
  const { userName, userEmail, scansThisWeek, scansThisMonth, remainingScans, tier, recentFindings, topIssues, unsubscribeUrl, dashboardUrl } = data;

  const tierLabels = { free: 'Free', pro: 'Pro', team: 'Team' };
  const tierColors = { free: '#6b7280', pro: '#3b82f6', team: '#f59e0b' };
  const tierColor = tierColors[tier];

  const severityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Spreadsheet Health Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Weekly Digest</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your spreadsheet health summary</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 24px 16px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #1f2937;">Hi ${userName || 'there'},</p>
              <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Here's your weekly spreadsheet health summary for the week ending ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.</p>
            </td>
          </tr>

          <!-- Tier Badge -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background-color: ${tierColor}15; color: ${tierColor}; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${tierLabels[tier]} Plan
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats Grid -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding: 0 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 20px 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 28px; font-weight: 700; color: #166534; line-height: 1;">${scansThisWeek}</div>
                          <div style="font-size: 13px; color: #166534; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Scans This Week</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 50%; padding: 0 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 20px 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 28px; font-weight: 700; color: #1e40af; line-height: 1;">${scansThisMonth}</div>
                          <div style="font-size: 13px; color: #1e40af; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Scans This Month</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Remaining Scans (Free tier only) -->
          ${tier === 'free' ? `
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="text-align: center;">
                    <div style="font-size: 14px; color: #92400e; font-weight: 500;">
                      ${remainingScans} of 3 scans remaining this month
                    </div>
                    <div style="font-size: 13px; color: #92400e; margin-top: 4px;">
                      Resets on the 1st. <a href="${dashboardUrl}" style="color: #92400e; font-weight: 600;">Upgrade to Pro</a> for unlimited scans.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Findings Summary -->
          ${recentFindings.critical + recentFindings.high + recentFindings.medium + recentFindings.low > 0 ? `
          <tr>
            <td style="padding: 0 24px 16px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #1f2937;">Recent Findings</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="width: 25%; padding: 0 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; padding: 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 24px; font-weight: 700; color: ${severityColors.critical}; line-height: 1;">${recentFindings.critical}</div>
                          <div style="font-size: 12px; color: ${severityColors.critical}; text-transform: uppercase;">Critical</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 25%; padding: 0 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7ed; border-radius: 8px; padding: 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 24px; font-weight: 700; color: ${severityColors.high}; line-height: 1;">${recentFindings.high}</div>
                          <div style="font-size: 12px; color: ${severityColors.high}; text-transform: uppercase;">High</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 25%; padding: 0 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; padding: 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 24px; font-weight: 700; color: ${severityColors.medium}; line-height: 1;">${recentFindings.medium}</div>
                          <div style="font-size: 12px; color: ${severityColors.medium}; text-transform: uppercase;">Medium</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 25%; padding: 0 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
                      <tr>
                        <td>
                          <div style="font-size: 24px; font-weight: 700; color: ${severityColors.low}; line-height: 1;">${recentFindings.low}</div>
                          <div style="font-size: 12px; color: ${severityColors.low}; text-transform: uppercase;">Low</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Top Issues -->
          ${topIssues.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 24px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #1f2937;">Top Issues to Review</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                ${topIssues.slice(0, 3).map(issue => `
                <tr>
                  <td style="padding: 12px 16px; background-color: #f9fafb; border: 1px solid #e5e7eb; ${issue === topIssues[0] ? 'border-radius: 8px 8px 0 0;' : issue === topIssues[topIssues.length - 1] ? 'border-radius: 0 0 8px 8px;' : ''}">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 28px; vertical-align: top;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${severityColors[issue.severity as keyof typeof severityColors] || severityColors.medium}; margin-top: 6px;"></span>
                        </td>
                        <td style="vertical-align: top;">
                          <div style="font-size: 14px; font-weight: 500; color: #1f2937; margin-bottom: 2px;">${issue.title}</div>
                          <div style="font-size: 12px; color: #9ca3af;">${issue.fileName}</div>
                        </td>
                        <td style="width: 80px; text-align: right; vertical-align: top;">
                          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: ${severityColors[issue.severity as keyof typeof severityColors] || severityColors.medium};">${issue.severity}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 24px 32px; text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                View Dashboard
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 24px 32px; text-align: center;">
              <p style="margin: 0 0 12px; font-size: 13px; color: #9ca3af;">
                Spreadsheet Health Checker · Automated spreadsheet validation
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; color: #9ca3af;">
                <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> · 
                <a href="${dashboardUrl}" style="color: #9ca3af; text-decoration: underline;">Manage Preferences</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #d1d5db;">
                Sent to ${userEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateDigestText(data: DigestData): string {
  const { userName, scansThisWeek, scansThisMonth, remainingScans, tier, recentFindings, topIssues, dashboardUrl, unsubscribeUrl } = data;

  let text = `
Hi ${userName || 'there'},

Your Weekly Spreadsheet Health Digest
=====================================

Plan: ${tier.charAt(0).toUpperCase() + tier.slice(1)}

This Week: ${scansThisWeek} scans
This Month: ${scansThisMonth} scans
`;

  if (tier === 'free') {
    text += `Remaining: ${remainingScans} of 3 scans\n`;
  }

  text += `
Recent Findings:
  Critical: ${recentFindings.critical}
  High: ${recentFindings.high}
  Medium: ${recentFindings.medium}
  Low: ${recentFindings.low}
`;

  if (topIssues.length > 0) {
    text += `\nTop Issues:\n`;
    topIssues.slice(0, 3).forEach(issue => {
      text += `  • [${issue.severity.toUpperCase()}] ${issue.title} (${issue.fileName})\n`;
    });
  }

  text += `
View your dashboard: ${dashboardUrl}

---
Unsubscribe: ${unsubscribeUrl}
Manage preferences: ${dashboardUrl}
  `.trim();

  return text;
}