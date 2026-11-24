import { Navigate } from 'react-router-dom';

export default function EntryPage() {
  return <Navigate to="/matgo/play?solo=1" replace />;
}
