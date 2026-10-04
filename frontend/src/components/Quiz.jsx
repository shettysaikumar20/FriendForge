import { apiFetch } from '../api';
import React, { useState } from 'react';
const API = import.meta.env.VITE_API_BASE_URL || '';
export default function Quiz({ quiz, onMemoryChange, onBusyChange }) {
  const [index, setIndex] = useState(0);
  const [option, setOption] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy || option === null) return;
    setBusy(true); onBusyChange(true); setError('');
    try {
      const response = await apiFetch(`${API}/api/quiz/${quiz.id}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index, option }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Answer could not be submitted.');
      setFeedback(data); if (data.complete) onMemoryChange();
    } catch (err) { setError(err.message || 'Connection failed. Please retry.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  const question = quiz.questions[index];
  return <section className="forge-card quiz-card" aria-label="Interactive quiz" aria-busy={busy}>
    <h2 className="section-title">Question {index + 1} / {quiz.total}</h2>
    <form onSubmit={submit}>
      <fieldset disabled={busy || Boolean(feedback)}>
        <legend>{question.question}</legend>
        {question.options.map((text, i) => <label className="quiz-option" key={i}>
          <input type="radio" name={`question-${quiz.id}-${index}`} checked={option === i} onChange={() => setOption(i)} />
          <span>{text}</span>
        </label>)}
      </fieldset>
      {!feedback && <button className="browse-btn" disabled={busy || option === null}>{busy ? 'Checking answer...' : 'Submit answer'}</button>}
    </form>
    {error && <p role="alert">{error}</p>}
    {feedback && <div role="status" className="quiz-feedback">
      <strong>{feedback.correct ? 'Correct!' : `Not quite. Correct answer: ${question.options[feedback.correctAnswer]}`}</strong>
      <p>{feedback.explanation}</p>
      {feedback.source?.length > 0 && <p>Retrieved sources: {feedback.source.join(', ')}</p>}
      {feedback.complete ? <><h3>Score: {feedback.score} / {feedback.total}</h3>
        <p>{feedback.memoryWarning || (feedback.memoryUpdated ? 'Your study memory has been refreshed.' : 'There were too few questions per topic to change memory reliably.')}</p>
        <p>Try Revise to practice your weakest saved topic.</p></> :
        <button className="browse-btn" onClick={() => { setIndex(v => v + 1); setOption(null); setFeedback(null); }}>Next question</button>}
    </div>}
  </section>;
}
