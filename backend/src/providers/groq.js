
import { config } from '../config.js';
import { ProviderError } from '../errors.js';

const maxTranscriptCharacters = 80000;
const allowedSentiments = new Set(['positive', 'neutral', 'negative']);
const allowedOutcomes = new Set(['resolved', 'unresolved', 'follow-up required']);

const systemPrompt = `أنت مقيّم جودة متخصص في خدمة العملاء ومراكز الاتصال. حلّل النص المرفق فقط، ولا تضف أي معلومة غير مدعومة به. أخرج كائن JSON صالحًا فقط بهذه المفاتيح:
summary (ملخص عربي موجز),
sentiment (positive أو neutral أو negative),
customerSatisfaction (عدد صحيح من 0 إلى 100),
qaScore (عدد صحيح من 0 إلى 100),
keywords (مصفوفة كلمات/موضوعات عربية),
customerIssues (مصفوفة مشكلات العميل المثبتة بالنص),
agentPerformance (تقييم عربي للأداء مع ذكر حدود الأدلة),
strengths (مصفوفة سلوكيات إيجابية مدعومة بالنص),
improvements (مصفوفة فرص تحسين مدعومة بالنص),
recommendations (مصفوفة توصيات تدريب عملية),
criticalAlerts (مصفوفة مخاطر امتثال أو خدمة مثبتة بالنص؛ استخدم [] عند عدم وجود دليل),
callOutcome (resolved أو unresolved أو follow-up required).

استخدم هذا المقياس الثابت للـ QA: الافتتاح والاحترافية 20%، الاستماع وفهم الحاجة 25%، دقة الحل 25%، التعاطف والوضوح 15%، الإغلاق والخطوات التالية 15%. قيّم كل محور من الأدلة المتاحة فقط؛ لا تفترض أن خطوة حدثت إذا لم تظهر في النص. إذا كانت الأدلة محدودة فاخفض الثقة لغويًا في agentPerformance واستخدم sentiment محايدًا ودرجة رضا وسطية. لا تخلط بين غياب الدليل وإثبات سوء السلوك. جميع النصوص التفسيرية باللغة العربية، مع إبقاء قيم sentiment وcallOutcome ضمن الخيارات الإنجليزية المحددة.`;

function isScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function isStringList(value) {
  return Array.isArray(value)
    && value.length <= 30
    && value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 500);
}

function validateAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof value.summary === 'string' && value.summary.trim().length > 0
    && allowedSentiments.has(value.sentiment)
    && isScore(value.customerSatisfaction)
    && isScore(value.qaScore)
    && isStringList(value.keywords)
    && isStringList(value.customerIssues)
    && typeof value.agentPerformance === 'string' && value.agentPerformance.trim().length > 0
    && isStringList(value.strengths)
    && isStringList(value.improvements)
    && isStringList(value.recommendations)
    && isStringList(value.criticalAlerts)
    && allowedOutcomes.has(value.callOutcome);
}

function parseJson(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new ProviderError('analysis', 'GROQ_INVALID_RESPONSE');
  }
}

export async function analyzeTranscript(transcript, segments) {
  if (config.llmProvider !== 'groq' || !config.llmApiKey) {
    throw new ProviderError('analysis', 'GROQ_NOT_CONFIGURED');
  }
  if (typeof transcript !== 'string' || transcript.length > maxTranscriptCharacters) {
    throw new ProviderError('analysis', 'GROQ_TRANSCRIPT_TOO_LONG');
  }

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.llmModel,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              transcript,
              speakerSegments: segments.map(({ start, end, speaker, text }) => ({ start, end, speaker, text })),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(config.llmTimeoutMs),
    });
  } catch {
    throw new ProviderError('analysis', 'GROQ_REQUEST_FAILED');
  }

  if (!response.ok) {
    let errorPayload = {};
    let errorDetails = '';

    try {
      errorPayload = await response.json();
      errorDetails = errorPayload?.error?.message || '';
    } catch {
      errorDetails = 'Could not read Groq error response';
    }

    console.error('[Groq] API Error:', {
      status: response.status,
      message: errorDetails,
      failedGeneration: errorPayload?.error?.failed_generation || '',
    });

    throw new ProviderError('analysis', 'GROQ_REQUEST_FAILED');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderError('analysis', 'GROQ_REQUEST_FAILED');
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ProviderError('analysis', 'GROQ_INVALID_RESPONSE');

  const analysis = parseJson(content);
  if (!validateAnalysis(analysis)) throw new ProviderError('analysis', 'GROQ_INVALID_RESPONSE');

  return analysis;
}
