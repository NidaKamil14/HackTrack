import React from 'react';
import { buttonClasses } from './buttonClasses';
import { Spinner } from './Spinner';

/**
 * Button — the single source for clickable actions.
 * Render as a router link with `as={Link} to="/path"`, or as an anchor with `as="a"`.
 * `loading` disables the button, shows a spinner and sets aria-busy.
 */
export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  const isNativeButton = Component === 'button';
  const isDisabled = disabled || loading;

  return (
    <Component
      className={buttonClasses({ variant, size, className })}
      {...(isNativeButton
        ? { type: props.type || 'button', disabled: isDisabled }
        : { 'aria-disabled': isDisabled || undefined, tabIndex: isDisabled ? -1 : undefined })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner label="Loading" />}
      {children}
    </Component>
  );
}
