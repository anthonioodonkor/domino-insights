
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowUpRight,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  retrievedAt?: string;
};

type AskResponse = {
  answer?: string;
  error?: string;
  retrievedAt?: string;
};

const suggestions = [
  {
    label: 'UPS dependencies',
    question: 'Which systems directly depend on MS-UPS-1?',
  },
  {
    label: 'Recorded faults',
    question: 'Are there any unresolved faults recorded?',
  },
  {
    label: 'Tenant exposure',
    question: 'Which tenants depend on the server halls?',
  },
  {
    label: 'Chiller performance',
    question: 'What do the historical chiller readings show?',
  },
];

export default function AskDominoChat() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function chooseSuggestion(value: string) {
    setQuestion(value);
    setError('');
    inputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedQuestion = question.trim();

    if (!submittedQuestion || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: submittedQuestion,
        }),
      });

      const data: AskResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed: HTTP ${response.status}`
        );
      }

      const answer = data.answer?.trim();

      if (!answer) {
        throw new Error('The AI returned an empty answer.');
      }

      setMessages((previous) => [
        ...previous,
        {
          role: 'user',
          text: submittedQuestion,
        },
        {
          role: 'assistant',
          text: answer,
          retrievedAt: data.retrievedAt,
        },
      ]);

      setQuestion('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to contact Ask Domino AI.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_16px_48px_-36px_rgba(1,42,45,0.3)]">
      <div className="border-b border-slate-100 px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d9e7dc] bg-[#edf4ee]">
              <Sparkles
                size={22}
                strokeWidth={1.7}
                className="text-cbre-forest"
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#698575]">
                Building Intelligence
              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-cbre-deep sm:text-2xl">
                Ask Domino AI
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#dce8df] bg-[#f4f8f5] px-3 py-1.5 text-[11px] font-semibold text-cbre-forest">
            <ShieldCheck size={13} aria-hidden="true" />
            Read-only
          </span>
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-500">
          Explore your building infrastructure through natural language.
          Answers are grounded in recorded campus data and clearly
          distinguish historical simulations from operational records.
        </p>
      </div>

      <div className="space-y-6 px-6 py-7 sm:px-8 sm:py-8">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#71877b]">
                Start with a question
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Select a topic below or write your own question.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestions.map(({ label, question: suggestion }) => (
                <button
                  key={label}
                  type="button"
                  disabled={loading}
                  onClick={() => chooseSuggestion(suggestion)}
                  className="rounded-full border border-[#d7e4da] bg-[#fafcfb] px-4 py-2.5 text-xs font-medium text-[#3e6652] transition-[background-color,border-color,transform] duration-200 hover:border-[#a9c8b1] hover:bg-[#edf4ee] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a7c5ae]/40 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div
            role="log"
            aria-label="Ask Domino AI conversation"
            aria-live="polite"
            aria-relevant="additions"
            className="max-h-[460px] space-y-4 overflow-y-auto pr-1"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-xl border px-5 py-4 sm:px-6 sm:py-5 ${
                  message.role === 'user'
                    ? 'ml-4 border-[#d9e8dd] bg-[#f0f6f1] sm:ml-12'
                    : 'mr-4 border-slate-200/70 bg-[#fafbf9] sm:mr-12'
                }`}
              >
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-cbre-deep">
                  {message.role === 'assistant' ? (
                    <Sparkles
                      size={15}
                      className="text-[#5e836c]"
                      aria-hidden="true"
                    />
                  ) : (
                    <MessageSquareText
                      size={15}
                      className="text-[#5e836c]"
                      aria-hidden="true"
                    />
                  )}

                  {message.role === 'assistant'
                    ? 'Domino AI'
                    : 'You'}
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#344941]">
                  {message.text}
                </p>

                {message.retrievedAt && (
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-200/70 pt-3 text-[11px] text-slate-500">
                    <Clock3 size={13} aria-hidden="true" />
                    Evidence retrieved:{' '}
                    {new Date(message.retrievedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-[#dce8df] bg-[#f6f9f6] px-4 py-4 text-sm text-[#557163]"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#5f896c] motion-reduce:animate-none" />
            Analyzing database evidence...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            htmlFor="domino-question"
            className="block text-sm font-semibold text-cbre-deep"
          >
            Your question
          </label>

          <div className="rounded-xl border border-[#d6e1d9] bg-white p-3 transition-[border-color,box-shadow] duration-200 focus-within:border-[#7ca68c] focus-within:ring-4 focus-within:ring-[#a7c5ae]/25">
            <textarea
              ref={inputRef}
              id="domino-question"
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              placeholder="Ask about UPS dependencies, equipment faults, or tenant exposure..."
              maxLength={500}
              rows={3}
              disabled={loading}
              required
              aria-describedby="domino-chat-note"
              className="min-h-24 w-full resize-y bg-transparent p-2 text-sm leading-6 text-cbre-deep outline-none placeholder:text-[#94a49a] disabled:opacity-60"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-2 pt-3">
              <span className="text-[11px] tabular-nums text-slate-400">
                {question.length}/500 characters
              </span>

              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-cbre-forest px-5 py-3 text-xs font-semibold text-white shadow-[0_5px_14px_-8px_rgba(0,63,45,0.8)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#145840] hover:shadow-[0_8px_18px_-8px_rgba(0,63,45,0.6)] motion-safe:hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a7c5ae]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none disabled:motion-safe:hover:scale-100"
              >
                {loading ? 'Analyzing...' : 'Ask Domino AI'}

                <ArrowUpRight
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                />
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {error}
            </p>
          )}
        </form>

        <div
          id="domino-chat-note"
          className="flex items-start gap-2 border-t border-slate-100 pt-5 text-[11px] leading-5 text-slate-500"
        >
          <ShieldCheck
            size={15}
            className="mt-0.5 shrink-0 text-[#6a8c75]"
            aria-hidden="true"
          />

          <span>
            Read-only demonstration. Campus and tenant records are
            fictional. Historical research telemetry is not live.
            Each question is evaluated independently.
          </span>
        </div>
      </div>
    </section>
  );
}
