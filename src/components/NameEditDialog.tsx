import { useState, type FormEvent } from 'react';
import { cleanDisplayName, DISPLAY_NAME_LIMIT } from '../lib/displayName';

interface Props {
  name: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function NameEditDialog({ name, onSave, onClose }: Props) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = cleanDisplayName(value);
    if (!next) {
      setError('이름을 입력해 주세요.');
      return;
    }
    onSave(next);
  };
  return <div className="name-edit-layer">
    <form className="name-edit-panel" role="dialog" aria-modal="true" aria-labelledby="name-edit-title" onSubmit={submit}>
      <h2 id="name-edit-title">이름 수정</h2>
      <label>내 이름
        <input value={value} maxLength={DISPLAY_NAME_LIMIT} autoFocus onChange={event => { setValue(event.target.value); setError(''); }} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="name-edit-actions">
        <button type="submit">저장</button>
        <button type="button" onClick={onClose}>닫기</button>
      </div>
    </form>
  </div>;
}
