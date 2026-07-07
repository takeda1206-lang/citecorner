import { Fragment } from 'react';
import { buildOutputs, pageRange, allAuthors } from '../lib/format.js';
import CopyButton from './CopyButton.jsx';

export default function ResultCard({ citation }) {
  const c = citation;
  const isJa = c.lang === 'ja';
  const outputs = buildOutputs(c);
  const pages = pageRange(c);

  const fields = [
    ['著者', c.authors.length ? allAuthors(c) : null],
    ['タイトル', c.title],
    ['雑誌略名', c.journalAbbrev],
    ['雑誌名', c.journalFull],
    ['年', c.year],
    ['巻', c.volume],
    ['号', c.issue],
    ['頁', pages || null],
    ['DOI', c.doi],
    ['PMID', c.pmid],
  ];

  return (
    <>
      {/* 日本語文献では修正欄が項目一覧を兼ねるため「取得した情報」カードは出さない */}
      {!isJa && (
        <div className="card">
          <h2 className="card-title">
            <span className="dot" />
            取得した情報
            {c.estimated && <span className="badge">推定（要確認）</span>}
          </h2>
          <div className="fields">
            {fields.map(([k, v]) => (
              <Fragment key={k}>
                <div className="field-key">{k}</div>
                <div className={`field-val ${v ? '' : 'none'}`}>{v || 'なし'}</div>
              </Fragment>
            ))}
          </div>
          {c.sources && c.sources.length > 0 && (
            <div className="source-note">情報源: {c.sources.join(' / ')}</div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="card-title">
          <span className="dot" />
          整形結果
          {isJa && <span className="badge badge-green">日本語（検索なし）</span>}
        </h2>
        <div className="outputs">
          {outputs.map((o) => {
            const empty = !o.value || o.value === 'なし';
            return (
              <div className="output" key={o.key}>
                <div className="output-head">
                  <div className="output-label">
                    {o.label}
                    {o.hint && <span className="output-hint">（{o.hint}）</span>}
                  </div>
                  <CopyButton text={o.value} />
                </div>
                <div className={`output-value ${empty ? 'none' : ''}`}>
                  {o.value || 'なし'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
