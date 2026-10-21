import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { Alert, Button, Field, Input } from '../components/ui';
import api from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!token) {
      setFeedback({ type: 'error', message: 'Password reset token is missing from the link.' });
      return;
    }

    if (password.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match. Please re-enter.' });
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setFeedback({
        type: 'success',
        message: 'Your password has been successfully reset. You can now sign in with your new credentials.'
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to reset password. The link may have expired or already been used.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 surface-panel rounded-2xl border border-line p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-fg">
            Choose a new password
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            Enter a secure password for your HackTrack account.
          </p>
        </div>

        {feedback && (
          <Alert variant={feedback.type === 'error' ? 'danger' : 'success'}>
            {feedback.message}
          </Alert>
        )}

        {!token && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-fg-muted">
              No reset token found in your request link. Please request a new password reset link from the login page.
            </p>
            <Link to="/login" className="inline-flex items-center text-sm font-medium text-accent hover:underline">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Sign in
            </Link>
          </div>
        )}

        {token && !success && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Field label="New Password" hint="Minimum 6 characters">
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={loading}
              />
            </Field>

            <Field label="Confirm Password">
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={loading}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Reset Password
            </Button>
          </form>
        )}

        {success && (
          <div className="pt-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Proceed to Sign in
            </Button>
          </div>
        )}

        <div className="pt-4 border-t border-line text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-sm font-medium text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
