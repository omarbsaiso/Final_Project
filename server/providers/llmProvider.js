import { config } from '../config.js';

function buildPrompt(transcript) {
  return `أنت محلل جودة لمكالمات خدمة عملاء. حلّل النص العربي التالي فقط ولا تخترع أي معلومة غير مذكورة.

أعد JSON صالحًا فقط دون أي نص خارجي أو تنسيق Markdown. يجب أن تكون جميع القيم التي يراها المستخدم بالعربية، باستثناء مفاتيح JSON وحقل customerSentimentCode الذي يمكن أن يكون Positive أو Neutral أو Negative.

استخدم هذا الشكل تمامًا:
{
  "summary": "ملخص واقعي بالعربية",
  "topic": "الموضوع الرئيسي",
  "category": "تصنيف المكالمة",
  "customerSentimentCode": "Positive|Neutral|Negative",
  "customerSentiment": "إيجابي|محايد|سلبي",
  "mainIssue": "المطلب أو المشكلة الرئيسية، أو \"لا يمكن الاستدلال منها\"",
  "satisfactionIndicators": ["مؤشرات رضا واقعية أو \"لا تتوفر مؤشرات كافية\""],
  "qualityScore": 0,
  "agentStrengths": ["نقاط قوة مدعومة بالنص"],
  "agentWeaknesses": ["أخطاء أو جوانب ضعف مدعومة بالنص، أو \"لا تتوفر أدلة كافية\""],
  "compliance": "تقييم الامتثال ومعايير الخدمة بالعربية",
  "recommendations": ["توصيات تحسين قابلة للتنفيذ"],
  "criteria": [{"name":"معيار الجودة","score":0,"note":"ملاحظة بالعربية"}],
  "keywords": ["موضوع رئيسي بالعربية"]
}

قواعد التقييم:
- qualityScore ودرجات criteria من 0 إلى 100.
- لا تستخدم أي اجتهاد أو معلومات خارج النص.
- إن تعذر تحديد أي حقل استخدم عبارة صريحة: "لا يمكن الاستدلال من النص المتوفر".
- ميّز بين العميل والموظف قدر الإمكان.
- إذا كان النص قصيرًا أو غير واضح، خفّض الثقة ولا تختلق معلومات.

النص العربي:
${transcript}`;
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
    throw new Error('Malformed JSON response from LLM provider.');
  }
}

function validateAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('LLM returned invalid JSON.');
  const unavailable = 'لا يمكن الاستدلال من النص المتوفر';
  const score = Number(value.qualityScore);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('LLM qualityScore is missing or outside 0-100.');
  const array = (item) => Array.isArray(item) ? item.filter((entry) => typeof entry === 'string') : [unavailable];
  const criteria = Array.isArray(value.criteria) ? value.criteria.map((entry) => ({
    name: typeof entry?.name === 'string' ? entry.name : 'معيار جودة',
    score: Number.isFinite(Number(entry?.score)) ? Math.max(0, Math.min(100, Number(entry.score))) : 0,
    note: typeof entry?.note === 'string' ? entry.note : unavailable,
  })) : [];
  return {
    summary: typeof value.summary === 'string' ? value.summary : unavailable,
    topic: typeof value.topic === 'string' ? value.topic : unavailable,
    category: typeof value.category === 'string' ? value.category : unavailable,
    customerSentimentCode: ['Positive', 'Neutral', 'Negative'].includes(value.customerSentimentCode) ? value.customerSentimentCode : 'Neutral',
    customerSentiment: typeof value.customerSentiment === 'string' ? value.customerSentiment : 'محايد',
    mainIssue: typeof value.mainIssue === 'string' ? value.mainIssue : unavailable,
    satisfactionIndicators: array(value.satisfactionIndicators),
    qualityScore: score,
    agentStrengths: array(value.agentStrengths),
    agentWeaknesses: array(value.agentWeaknesses),
    compliance: typeof value.compliance === 'string' ? value.compliance : unavailable,
    recommendations: array(value.recommendations),
    criteria,
    keywords: array(value.keywords),
  };
}

async function groqAnalyze(transcript) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.llmApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.llmModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'أنت محلل جودة مكالمات عربي دقيق.' }, { role: 'user', content: buildPrompt(transcript) }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'Groq analysis request failed.');
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned an empty analysis response.');
  return validateAnalysis(extractJson(text));
}

async function geminiAnalyze(transcript) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.llmApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: buildPrompt(transcript) }] }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'Gemini analysis request failed.');
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join('');
  if (!text) throw new Error('Gemini returned an empty analysis response.');
  return validateAnalysis(extractJson(text));
}

export async function analyzeTranscript(transcript) {
  if (config.llmProvider === 'gemini') return geminiAnalyze(transcript);
  if (config.llmProvider === 'groq') return groqAnalyze(transcript);
  throw new Error(`Unsupported LLM_PROVIDER: ${config.llmProvider}`);
}
