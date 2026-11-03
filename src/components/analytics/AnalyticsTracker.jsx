import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../../utils/analytics';

/** Reports a page view on every route change. Renders nothing. */
export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  return null;
}
