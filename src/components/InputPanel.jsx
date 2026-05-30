import { useState } from 'react';
import DoiInput from './DoiInput.jsx';
import PmidInput from './PmidInput.jsx';
import TitleInput from './TitleInput.jsx';
import PdfInput from './PdfInput.jsx';
import ImageTextInput from './ImageTextInput.jsx';

const TABS = [
  { key: 'doi', label: 'DOI' },
  { key: 'pmid', label: 'PMID' },
  { key: 'title', label: 'タイトル' },
  { key: 'pdf', label: 'PDF' },
  { key: 'image', label: '画像・テキスト' },
];

export default function InputPanel({ run, onResult, busy, onSwitch }) {
  const [tab, setTab] = useState('doi');

  function choose(k) {
    if (k === tab) return;
    setTab(k);
    if (onSwitch) onSwitch();
  }

  const formProps = { run, onResult, busy };

  return (
    <div className="card">
      <h2 className="card-title">
        <span className="dot" />
        入力
      </h2>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => choose(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'doi' && <DoiInput {...formProps} />}
      {tab === 'pmid' && <PmidInput {...formProps} />}
      {tab === 'title' && <TitleInput {...formProps} />}
      {tab === 'pdf' && <PdfInput {...formProps} />}
      {tab === 'image' && <ImageTextInput {...formProps} />}
    </div>
  );
}
