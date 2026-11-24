import { useState } from 'react';

interface Props {
  error: string;
  addresses: string[];
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onSolo: () => void;
}

export default function MultiplayerLobby({ error, addresses, onCreate, onJoin, onSolo }: Props) {
  const [name, setName] = useState('나');
  const [code, setCode] = useState('');
  const originPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return <main className="multiplayer-lobby">
    <section>
      <p className="eyebrow">2인 맞고</p>
      <h1>같이 두기</h1>
      <p>한 사람이 방을 만들고, 다른 사람은 같은 와이파이에서 방 코드를 입력합니다.</p>
      <label>이름<input value={name} maxLength={12} onChange={event => setName(event.target.value)} /></label>
      <button type="button" className="primary-button" onClick={() => onCreate(name.trim() || '나')}>방 만들기</button>
      <form onSubmit={event => { event.preventDefault(); onJoin(code, name.trim() || '상대'); }}>
        <label>방 코드<input value={code} maxLength={4} autoCapitalize="characters" onChange={event => setCode(event.target.value.toUpperCase())} /></label>
        <button type="submit" className="primary-button">들어가기</button>
      </form>
      {addresses.length > 0 && <p className="multiplayer-address">폰에서는 {addresses.map(ip => `http://${ip}:${originPort}/matgo/play?multi=1`).join(' 또는 ')} 로 여세요.</p>}
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
      <button type="button" className="text-button" onClick={onSolo}>혼자 하기</button>
    </section>
  </main>;
}
