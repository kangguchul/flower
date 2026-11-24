import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/PageLayout';

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}초`;
  return `${minutes}분 ${rest}초`;
}

function clock(at: number) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

interface Point { at: number; current: number; }
interface Person { visitorId: string; visits: number; ips: string[]; averageMs: number; }
interface Report {
  averageMs: number;
  maxConcurrent: number;
  current?: number;
  today?: number;
  total?: number;
  series: Point[];
  people: Person[];
  plays?: string[];
  source?: string;
}

function addressList(ips: string[]) {
  const visible = ips.filter(ip => ip && ip !== 'unknown');
  return visible.join(', ') || '알 수 없음';
}

function AccessChart({ points }: { points: Point[] }) {
  const width = 640;
  const height = 220;
  const pad = 28;
  const peak = Math.max(1, ...points.map(point => point.current));
  const coordinates = points.map((point, index) => {
    const x = pad + (points.length <= 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
    const y = height - pad - (point.current / peak) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return <svg className="access-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="동시 접속 그래프">
    <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
    {points.length > 0 && <polyline points={coordinates} />}
    <text x={pad} y={18}>{peak}명</text>
    <text x={pad} y={height - 8}>{points[0] ? clock(points[0].at) : ''}</text>
    <text x={width - 70} y={height - 8}>{points.length ? clock(points[points.length - 1].at) : ''}</text>
  </svg>;
}

const REFRESH_MS = 5 * 60 * 1000;

export default function AccessPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/visits/report', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('load')))
        .then(payload => {
          if (cancelled) return;
          setReport(payload);
          setLoadedAt(Date.now());
          setError('');
        })
        .catch(() => { if (!cancelled) setError('접속 그래프를 불러오지 못했습니다.'); });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return <PageLayout pageClassName="access-site-page">
    <div className="page-heading">
      <div><p className="eyebrow">접속</p><h1>접속 현황</h1></div>
      <p>최근 24시간의 동시 접속과 개인별 접속 기록입니다.</p>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {report && <>
      <section className="access-summary" aria-label="접속 요약">
        <article><span>현재 접속</span><strong>{(report.current ?? 0).toLocaleString('ko-KR')}명</strong></article>
        <article><span>오늘 접속</span><strong>{(report.today ?? 0).toLocaleString('ko-KR')}명</strong></article>
        <article><span>누적 접속</span><strong>{(report.total ?? 0).toLocaleString('ko-KR')}명</strong></article>
        <article><span>동시 최대 접속자 수</span><strong>{report.maxConcurrent.toLocaleString('ko-KR')}명</strong></article>
        <article><span>접속 평균 시간</span><strong>{formatDuration(report.averageMs)}</strong></article>
      </section>
      <section className="panel-card access-panel" aria-label="동시 접속 그래프">
        <h2>동시 접속</h2>
        {report.series.length === 0 ? <p className="board-empty">아직 그릴 접속 기록이 없습니다.</p> : <AccessChart points={report.series} />}
      </section>
      <section className="panel-card access-panel" aria-label="최근 8일 아이피별 접속자 수">
        <h2>최근 8일 접속자</h2>
        <p className="access-note">아이피별 접속자 수입니다. 5분마다 갱신합니다.{loadedAt ? ` 마지막 표시 ${clock(loadedAt)}.` : ''}</p>
        {(report.plays ?? []).length === 0 ? <p className="board-empty">아직 표시할 접속자가 없습니다.</p> : <ul className="access-play-list">
          {report.plays?.map((line, index) => <li key={`${line}:${index}`}>{line}</li>)}
        </ul>}
      </section>
      <section className="panel-card access-panel" aria-label="개인별 접속">
        <h2>개인별 접속</h2>
        <p className="access-note">맥 주소는 브라우저가 서버로 보내지 않아 수집하지 않습니다. 아이피는 서버가 받은 접속 주소입니다.</p>
        {report.people.length === 0 ? <p className="board-empty">아직 개인 접속 기록이 없습니다.</p> : <div className="access-table-wrap">
          <table className="access-table">
            <thead><tr><th>접속 수</th><th>평균 시간</th><th>아이피</th><th>식별값</th></tr></thead>
            <tbody>
              {report.people.map(person => <tr key={person.visitorId}>
                <td>{person.visits.toLocaleString('ko-KR')}</td>
                <td>{formatDuration(person.averageMs)}</td>
                <td>{addressList(person.ips)}</td>
                <td>{person.visitorId}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </>}
    <p><Link to="/">게임으로 돌아가기</Link></p>
  </PageLayout>;
}
