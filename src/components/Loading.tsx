import { useEffect, useState } from 'react';
import { loadVisitCount, readVisitTotal } from '../lib/visitCount';

export default function Loading({ message = '상대를 찾고있습니다.', visitorCount }: { message?: string; visitorCount?: number | null }) {
  const [count, setCount] = useState<number | null>(visitorCount ?? readVisitTotal());
  useEffect(() => {
    if (visitorCount != null) {
      setCount(visitorCount);
      return;
    }
    let cancelled = false;
    loadVisitCount().then(total => {
      if (!cancelled && total != null) setCount(total);
    });
    return () => { cancelled = true; };
  }, [visitorCount]);
  return <main className="loading-page" aria-live="polite">
    <section className="loading-panel">
      <div className="loading-brand" aria-label="가족화투"><span>가족</span><b>화투</b></div>
      <div className="loading-cards" aria-hidden="true"><span>花</span><span>光</span></div>
      <p>{message}</p>
      {count != null && <p className="loading-visits">당신은 <b>{count.toLocaleString('ko-KR')}</b>번째 접속자입니다</p>}
      <div className="loading-progress" aria-hidden="true"><span /></div>
    </section>
  </main>;
}
