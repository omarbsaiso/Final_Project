const callTime = (minutesAgo) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
const documentTime = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export const demoUsers = [
  { uid: 'demo-admin', name: 'Olivia Martinez', email: 'admin@callminer.demo', role: 'Admin', team: 'Customer Care', active: true },
  { uid: 'demo-supervisor', name: 'Marcus Chen', email: 'supervisor@callminer.demo', role: 'Supervisor', team: 'Customer Care', active: true },
  { uid: 'demo-agent', name: 'Ava Johnson', email: 'agent@callminer.demo', role: 'Agent', team: 'Customer Care', active: true },
  { uid: 'agent-2', name: 'Noah Williams', email: 'noah@callminer.demo', role: 'Agent', team: 'Customer Care', active: true },
  { uid: 'agent-3', name: 'Sofia Patel', email: 'sofia@callminer.demo', role: 'Agent', team: 'Customer Care', active: true },
  { uid: 'agent-4', name: 'Ethan Brooks', email: 'ethan@callminer.demo', role: 'Agent', team: 'Retention', active: true },
];

export const demoCalls = [
  { id: 'CM-24891', analysisSource: 'sample', customer: 'Jordan Lee', customerInitials: 'JL', agent: 'Ava Johnson', agentId: 'demo-agent', team: 'Customer Care', date: callTime(14), duration: '08:42', channel: 'Inbound', sentiment: 'Positive', score: 96, status: 'Reviewed', topic: 'Plan upgrade', summary: 'Agent clearly explained available plans and helped the customer move to a package better suited to their usage.' },
  { id: 'CM-24890', analysisSource: 'sample-summary', customer: 'Taylor Morgan', customerInitials: 'TM', agent: 'Noah Williams', agentId: 'agent-2', team: 'Customer Care', date: callTime(38), duration: '12:16', channel: 'Inbound', sentiment: 'Neutral', score: 88, status: 'Reviewed', topic: 'Billing question', summary: 'Customer asked about a recent invoice. The agent explained the charges and confirmed the billing cycle.' },
  { id: 'CM-24889', analysisSource: 'sample-summary', customer: 'Casey Rivera', customerInitials: 'CR', agent: 'Sofia Patel', agentId: 'agent-3', team: 'Customer Care', date: callTime(63), duration: '06:31', channel: 'Inbound', sentiment: 'Negative', score: 72, status: 'Needs review', topic: 'Late delivery', summary: 'Customer reported a delayed delivery. The agent apologized and arranged a replacement shipment.' },
  { id: 'CM-24888', analysisSource: 'sample-summary', customer: 'Riley Kim', customerInitials: 'RK', agent: 'Ethan Brooks', agentId: 'agent-4', team: 'Retention', date: callTime(95), duration: '15:04', channel: 'Outbound', sentiment: 'Positive', score: 94, status: 'Reviewed', topic: 'Renewal', summary: 'A proactive renewal conversation focused on customer needs and included a clear summary of the new term.' },
  { id: 'CM-24887', analysisSource: 'sample-summary', customer: 'Morgan Davis', customerInitials: 'MD', agent: 'Ava Johnson', agentId: 'demo-agent', team: 'Customer Care', date: callTime(130), duration: '09:28', channel: 'Inbound', sentiment: 'Neutral', score: 84, status: 'Processing', topic: 'Account access', summary: 'Customer needed help restoring account access. Identity checks were completed before troubleshooting.' },
  { id: 'CM-24886', analysisSource: 'sample-summary', customer: 'Jamie Wilson', customerInitials: 'JW', agent: 'Noah Williams', agentId: 'agent-2', team: 'Customer Care', date: callTime(255), duration: '07:52', channel: 'Inbound', sentiment: 'Negative', score: 68, status: 'Needs review', topic: 'Cancellation', summary: 'Customer expressed frustration about repeated service interruptions and requested to cancel.' },
  { id: 'CM-24885', analysisSource: 'sample-summary', customer: 'Alex Thompson', customerInitials: 'AT', agent: 'Sofia Patel', agentId: 'agent-3', team: 'Customer Care', date: callTime(310), duration: '11:09', channel: 'Inbound', sentiment: 'Positive', score: 91, status: 'Reviewed', topic: 'Product question', summary: 'The agent answered product questions with clear examples and checked that the customer felt confident.' },
  { id: 'CM-24884', analysisSource: 'sample-summary', customer: 'Sam Garcia', customerInitials: 'SG', agent: 'Ethan Brooks', agentId: 'agent-4', team: 'Retention', date: callTime(370), duration: '05:48', channel: 'Outbound', sentiment: 'Neutral', score: 82, status: 'Reviewed', topic: 'Follow-up', summary: 'A short follow-up call confirmed the customer received the requested information.' },
];

export const demoDocuments = [
  { id: 'doc-1', name: 'Customer Service Playbook.pdf', category: 'Guides', size: '2.4 MB', uploadedAt: documentTime(2), visibility: 'Everyone', type: 'PDF' },
  { id: 'doc-2', name: 'Billing & Refund Policy.docx', category: 'Policies', size: '840 KB', uploadedAt: documentTime(4), visibility: 'Everyone', type: 'DOCX' },
  { id: 'doc-3', name: 'Escalation Handling Guide.pdf', category: 'Guides', size: '1.8 MB', uploadedAt: documentTime(6), visibility: 'Supervisors', type: 'PDF' },
  { id: 'doc-4', name: 'Product FAQ — Spring.txt', category: 'FAQs', size: '128 KB', uploadedAt: documentTime(9), visibility: 'Everyone', type: 'TXT' },
  { id: 'doc-5', name: 'Retention Offers Q1.pdf', category: 'Policies', size: '1.1 MB', uploadedAt: documentTime(13), visibility: 'Supervisors', type: 'PDF' },
];

export const qaCriteria = [
  { name: 'Opening & verification', score: 100, note: 'Warm greeting; customer verified before account details.' },
  { name: 'Active listening', score: 95, note: 'Acknowledged the customer’s needs and asked a clarifying question.' },
  { name: 'Product knowledge', score: 90, note: 'Explained plan differences accurately and in plain language.' },
  { name: 'Resolution', score: 100, note: 'Completed the upgrade and confirmed the next billing date.' },
  { name: 'Closing', score: 95, note: 'Summarized actions and checked for any other questions.' },
];

export const transcript = [
  { time: '00:00', speaker: 'Agent', text: 'Thank you for calling Northstar Support. This is Ava. How can I help today?' },
  { time: '00:08', speaker: 'Customer', text: 'Hi, I’m looking at upgrading my plan, but I’m not sure which one makes sense for me.' },
  { time: '00:17', speaker: 'Agent', text: 'Absolutely, I can help with that. Before we start, may I verify the email address on your account?' },
  { time: '00:31', speaker: 'Customer', text: 'Sure, it’s jordan.lee@example.com.' },
  { time: '00:42', speaker: 'Agent', text: 'Thank you. I can see you’ve been using more data lately. Are there specific features you’re hoping to get from a new plan?' },
  { time: '01:02', speaker: 'Customer', text: 'Mostly more data, and maybe being able to share it with my family.' },
  { time: '01:15', speaker: 'Agent', text: 'That makes sense. The Plus plan includes shared data and would give you enough room for everyone. I can walk you through the monthly cost.' },
  { time: '01:36', speaker: 'Customer', text: 'That sounds good. Would the change happen right away?' },
  { time: '01:43', speaker: 'Agent', text: 'Yes, your new allowance starts today. Your billing date stays the same, and I’ll send a confirmation by email.' },
  { time: '02:02', speaker: 'Customer', text: 'Perfect, let’s go ahead with it.' },
  { time: '02:08', speaker: 'Agent', text: 'All set. Is there anything else I can help you with today?' },
  { time: '02:14', speaker: 'Customer', text: 'No, that’s everything. Thanks for making it so easy.' },
];

export const chartData = [
  { day: 'Mon', calls: 940, score: 86 },
  { day: 'Tue', calls: 1120, score: 88 },
  { day: 'Wed', calls: 980, score: 87 },
  { day: 'Thu', calls: 1310, score: 91 },
  { day: 'Fri', calls: 1180, score: 89 },
  { day: 'Sat', calls: 720, score: 92 },
  { day: 'Sun', calls: 560, score: 90 },
];
