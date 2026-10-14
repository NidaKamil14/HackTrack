import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center sm:py-32">
      <p className="text-gradient font-mono text-7xl font-semibold leading-none tracking-tight sm:text-8xl" aria-hidden="true">404</p>
      <p className="sr-only">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">
        The page you're looking for doesn't exist or has moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button as={Link} to="/">Go home</Button>
        <Button as={Link} to="/hackathons" variant="secondary">Browse hackathons</Button>
      </div>
    </div>
  );
}
