import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, cn } from '../ui';
import { getUserNotifications, markAsRead, markAllAsRead } from '../../utils/notificationService';
import api from '../../utils/api';

export default function NotificationCenterDialog({ open, onClose, user }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(() => (user ? getUserNotifications(user) : []));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    if (api.getToken()) {
      setLoading(true);
      api.getNotifications()
        .then((res) => {
          if (cancelled) return;
          const serverItems = Array.isArray(res?.notifications)
            ? res.notifications.map((n) => ({
                id: n.id,
                userEmail: user.email,
                title: n.title,
                message: n.message,
                type: n.category === 'announcement' ? 'info' : n.type === 'error' ? 'warning' : 'success',
                date: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                read: n.isRead,
                link: n.link || '/dashboard/student',
                isServer: true,
              }))
            : [];
          const localNotifs = getUserNotifications(user);
          const merged = [...serverItems];
          localNotifs.forEach((loc) => {
            if (!merged.some((m) => m.id === loc.id || (m.title === loc.title && m.message === loc.message))) {
              merged.push(loc);
            }
          });
          setNotifications(merged);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setNotifications(getUserNotifications(user));
    }

    return () => { cancelled = true; };
  }, [open, user]);

  const handleMarkAsRead = async (item) => {
    if (item.isServer && api.getToken()) {
      try {
        await api.markNotificationRead(item.id);
      } catch {}
    }
    markAsRead(item.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.link) {
      onClose();
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (api.getToken()) {
      try {
        await api.markAllNotificationsRead();
      } catch {}
    }
    markAllAsRead(user?.email);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Notification Center"
      description="Real-time competition updates, squad roster requests, and approaching deadlines."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-fg">Recent Activity</span>
            {unreadCount > 0 && (
              <Badge tone="accent">{unreadCount} unread</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              <Check aria-hidden="true" />
              Mark all as read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-fg-muted">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <EmptyState
            illustration="inbox"
            icon={Bell}
            title="No notifications yet"
            description="Activity, squad decisions, and competition updates will appear here automatically."
          />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto pr-1">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleMarkAsRead(n)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    !n.read ? 'bg-raised/70 hover:bg-raised' : 'hover:bg-raised/30'
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        !n.read ? 'bg-accent ring-4 ring-accent/20' : 'bg-line-strong'
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={cn('text-sm text-fg', !n.read ? 'font-semibold' : 'font-medium')}>
                          {n.title}
                        </span>
                        <span className="text-xs text-fg-subtle">{n.date}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-fg-muted">{n.message}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    {!n.read && <Badge tone="accent">New</Badge>}
                    {n.link && <ExternalLink className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
