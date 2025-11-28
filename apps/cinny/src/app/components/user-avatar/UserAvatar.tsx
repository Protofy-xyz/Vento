import { AvatarFallback, AvatarImage, color } from 'folds';
import React, { ReactEventHandler, ReactNode, useState } from 'react';
import classNames from 'classnames';
import * as css from './UserAvatar.css';
import colorMXID from '../../../util/colorMXID';

type UserAvatarProps = {
  className?: string;
  userId: string;
  src?: string;
  alt?: string;
  renderFallback: () => ReactNode;
  isSelf?: boolean; // If true, don't show background color (for current user)
};
export function UserAvatar({ className, userId, src, alt, renderFallback, isSelf }: UserAvatarProps) {
  const [error, setError] = useState(false);

  const handleLoad: ReactEventHandler<HTMLImageElement> = (evt) => {
    evt.currentTarget.setAttribute('data-image-loaded', 'true');
  };

  if (!src || error) {
    return (
      <AvatarFallback
        style={{ 
          backgroundColor: isSelf ? 'transparent' : colorMXID(userId), 
          color: isSelf ? 'var(--color9)' : color.Surface.Container 
        }}
        className={classNames(css.UserAvatar, className)}
      >
        {renderFallback()}
      </AvatarFallback>
    );
  }

  return (
    <AvatarImage
      className={classNames(css.UserAvatar, className)}
      src={src}
      alt={alt}
      onError={() => setError(true)}
      onLoad={handleLoad}
      draggable={false}
    />
  );
}
