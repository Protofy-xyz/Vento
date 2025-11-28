import { ReactNode, useRef, useEffect } from 'react';
import { useMatch, useLocation, useNavigate } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from './paths';

type MobileFriendlyClientNavProps = {
  children: ReactNode;
};
export function MobileFriendlyClientNav({ children }: MobileFriendlyClientNavProps) {
  const screenSize = useScreenSizeContext();
  const homeMatch = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const directMatch = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const spaceMatch = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const inboxMatch = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });

  if (
    screenSize === ScreenSize.Mobile &&
    !(homeMatch || directMatch || spaceMatch || exploreMatch || inboxMatch)
  ) {
    return null;
  }

  return children;
}

type MobileFriendlyPageNavProps = {
  path: string;
  children: ReactNode;
};
export function MobileFriendlyPageNav({ path, children }: MobileFriendlyPageNavProps) {
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const exactPath = useMatch({
    path,
    caseSensitive: true,
    end: true,
  });
  
  const isMobile = screenSize === ScreenSize.Mobile;
  
  // Track if user was viewing nav (sidebar) before going to desktop
  const wasViewingNavRef = useRef<boolean>(!!exactPath);
  const prevScreenSizeRef = useRef<ScreenSize>(screenSize);
  
  const wasMobile = prevScreenSizeRef.current === ScreenSize.Mobile;
  const wasDesktop = prevScreenSizeRef.current !== ScreenSize.Mobile;
  
  // While in mobile, track if nav is visible (exact path match)
  if (isMobile && wasMobile) {
    wasViewingNavRef.current = !!exactPath;
  }
  
  // When transitioning from desktop to mobile:
  // If we were viewing nav before going to desktop, navigate back to base path
  useEffect(() => {
    if (wasDesktop && isMobile && wasViewingNavRef.current && !exactPath) {
      // Navigate to base path to show sidebar
      navigate(path, { replace: true });
    }
  }, [isMobile, wasDesktop, exactPath, path, navigate]);
  
  // Update ref for next render
  prevScreenSizeRef.current = screenSize;

  // Standard mobile behavior
  if (isMobile && !exactPath) {
    return null;
  }

  return children;
}
