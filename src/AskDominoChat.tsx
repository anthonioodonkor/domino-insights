
import { useState } from 'react';
import type { FormEvent } from 'react';

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

export default function AskDominoChat() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      if (!data.answer) {
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
          text: data.answer!,
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
    <section
      style={{
        border: '1px solid #ddd',
        borderRadius: 10,
        padding: 20,
        background: '#fff',
        marginTop: 24,
      }}
    >
      <h2>Ask Domino AI</h2>

      <p style={{ color: '#64748b', fontSize: 14 }}>
        Ask questions about infrastructure, dependencies,
        faults, tenants, and historical research telemetry.
      </p>

      <div
        aria-live="polite"
        style={{
          maxHeight: 420,
          overflowY: 'auto',
          marginBottom: 20,
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#64748b' }}>
            Try: "Which systems directly depend on MS-UPS-1?"
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              background:
                message.role === 'user' ? '#eff6ff' : '#f8fafc',
              padding: 14,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <strong>
              {message.role === 'user'
                ? 'You'
                : 'Domino AI'}
            </strong>

            <p
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                marginBottom: 0,
              }}
            >
              {message.text}
            </p>

            {message.retrievedAt && (
              <small style={{ color: '#64748b' }}>
                Database evidence retrieved:{' '}
                {new Date(
                  message.retrievedAt
                ).toLocaleString()}
              </small>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="domino-question">
          <strong>Your question</strong>
        </label>

        <textarea
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
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 8,
            padding: 12,
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
          }}
        />

        {error && (
          <p role="alert" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            marginTop: 12,
            padding: '12px 20px',
            background: '#2563eb',
            color: '#fff',
            border: 0,
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading || !question.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Analyzing...' : 'Ask Domino AI'}
        </button>
      </form>

      <p style={{ fontSize: 12, color: '#64748b' }}>
        Read-only demonstration. Answers use fictional campus
        records and may include historical simulated data.
        Each question is evaluated independently.
      </p>
    </section>
  );
}
