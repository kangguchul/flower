import { Link } from 'react-router-dom';
import PageLayout from '../components/PageLayout';

const STEPS = [
  '게임을 열면 상대가 들어옵니다. 왼쪽 위의 판돈 버튼에서 점당 금액을 고릅니다.',
  '새 판에서는 바닥의 뒤집힌 패를 한 장 고릅니다. 낮에는 높은 달, 밤에는 낮은 달이 선입니다.',
  '내 차례에 손패를 누르면 같은 달의 바닥 패를 가져옵니다. 맞는 패가 없으면 그냥 냅니다.',
  '점수가 되면 고 또는 스톱을 고릅니다. 고를 하면 판이 이어지고, 스톱하면 그 판이 끝납니다.',
  '자동치기를 켜면 패를 대신 냅니다. 끄면 점수판에서 확인을 눌러야 다음 판이 시작됩니다.'
];

export default function CreditsPage() {
  return <PageLayout>
    <div className="page-heading credits-heading">
      <div><p className="eyebrow">가족화투</p><h1>사용법</h1></div>
      <p>패를 내고, 점수가 되면 고하거나 멈춥니다.</p>
    </div>

    <section className="panel-card guide-card">
      <h2>이렇게 칩니다</h2>
      <ol className="guide-steps">
        {STEPS.map(step => <li key={step}>{step}</li>)}
      </ol>
    </section>

    <section className="panel-card guide-card">
      <h2>문의</h2>
      <p>게임머니가 없거나 궁금한 점이 있으면 고객센터 게시판에 글을 남겨 주세요.</p>
      <div className="button-row">
        <Link className="primary-button" to="/board">고객센터 게시판</Link>
        <Link className="secondary-button" to="/">게임으로 돌아가기</Link>
      </div>
    </section>
  </PageLayout>;
}
