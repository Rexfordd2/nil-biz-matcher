/**
 * Outreach message templates for RecruitingV2
 */

export type OutreachTemplate = {
  id: string
  name: string
  subject: string
  body: string
}

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'initial-intro',
    name: 'Initial Introduction',
    subject: 'Introducing {athleteName} - {sport} {position}',
    body: `Dear Coach,

My name is {athleteName}, and I'm a {gradYear} {position} currently playing {sport} at {highSchool}.

I'm reaching out because I'm very interested in {orgName} and your program. I believe my skills and work ethic would be a great fit for your team.

Here are my current stats and highlights:
- {stats}

I'd love to learn more about your program and discuss potential opportunities. Would you be available for a brief call or meeting?

Thank you for your time and consideration.

Best regards,
{athleteName}
{email}
{phone}`
  },
  {
    id: 'follow-up',
    name: 'Follow-Up',
    subject: 'Following up - {athleteName}',
    body: `Dear Coach,

I wanted to follow up on my previous message regarding my interest in {orgName}.

I remain very interested in your program and would appreciate the opportunity to discuss how I could contribute to your team.

I'm happy to provide additional information, game film, or references if that would be helpful.

Thank you again for your consideration.

Best regards,
{athleteName}
{email}
{phone}`
  },
  {
    id: 'highlight-video',
    name: 'Share Highlight Video',
    subject: 'Highlight Video - {athleteName}',
    body: `Dear Coach,

I wanted to share my latest highlight video with you:
{videoUrl}

Quick stats:
- Position: {position}
- Grad Year: {gradYear}
- Key Stats: {stats}

I believe my playing style and abilities would align well with {orgName}'s program. I'd love to discuss opportunities to join your team.

Looking forward to hearing from you.

Best regards,
{athleteName}
{email}
{phone}`
  },
  {
    id: 'camp-interest',
    name: 'Camp/Showcase Interest',
    subject: 'Camp/Showcase Interest - {athleteName}',
    body: `Dear Coach,

I'm interested in attending any upcoming camps, showcases, or recruiting events hosted by {orgName}.

About me:
- Name: {athleteName}
- Sport: {sport}
- Position: {position}
- Grad Year: {gradYear}

Could you please share information about any upcoming opportunities where I could showcase my abilities to your coaching staff?

Thank you for your time.

Best regards,
{athleteName}
{email}
{phone}`
  }
]

export function fillTemplate(template: OutreachTemplate, placeholders: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject
  let body = template.body
  
  for (const [key, value] of Object.entries(placeholders)) {
    const placeholder = `{${key}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), value || '')
    body = body.replace(new RegExp(placeholder, 'g'), value || '')
  }
  
  return { subject, body }
}
