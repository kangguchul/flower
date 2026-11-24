import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/PageLayout';

interface BoardPost {
  id: string;
  name: string;
  body: string;
  createdAt: number;
}

const time = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export default function BoardPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/board/posts', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('load')))
      .then(payload => {
        if (!cancelled) setPosts(Array.isArray(payload?.posts) ? payload.posts : []);
      })
      .catch(() => {
        if (!cancelled) setError('게시글을 불러오지 못했습니다.');
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/board/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body })
      });
      if (!response.ok) throw new Error('save');
      const post = await response.json() as BoardPost;
      setPosts(current => [post, ...current.filter(item => item.id !== post.id)]);
      setBody('');
    }
    catch {
      setError('글을 올리지 못했습니다. 내용을 입력했는지 확인해 주세요.');
    }
    finally { setSending(false); }
  };

  return <PageLayout pageClassName="board-site-page">
    <div className="page-heading">
      <div><p className="eyebrow">방문객</p><h1>고객센터 게시판</h1></div>
      <p>게임머니가 없거나 문의가 있으면 글을 남겨 주세요.</p>
    </div>
    <form className="panel-card board-form" onSubmit={event => void submit(event)}>
      <label>이름<input value={name} maxLength={20} placeholder="손님" onChange={event => setName(event.target.value)} /></label>
      <label>내용<textarea value={body} maxLength={500} rows={5} required placeholder="문의 내용을 적어 주세요" onChange={event => setBody(event.target.value)} /></label>
      <div className="board-form-actions">
        <button className="primary-button" type="submit" disabled={sending}>{sending ? '올리는 중…' : '글 올리기'}</button>
        <Link className="secondary-button" to="/">게임으로 돌아가기</Link>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
    <section className="board-list" aria-label="게시글">
      {posts.length === 0 ? <p className="board-empty">아직 올라온 글이 없습니다.</p> : posts.map(post => <article className="panel-card board-post" key={post.id}>
        <header><b>{post.name || '손님'}</b><time dateTime={new Date(post.createdAt).toISOString()}>{time.format(post.createdAt)}</time></header>
        <p>{post.body}</p>
      </article>)}
    </section>
  </PageLayout>;
}
