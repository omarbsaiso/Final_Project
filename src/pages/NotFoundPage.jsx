import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return <div className="not-found-page"><span>404</span><h1>Page not found</h1><p>The page you’re looking for doesn’t exist or has moved.</p><Link className="btn btn-primary-custom" to="/"><ArrowLeft size={16} />Back to dashboard</Link></div>;
}
