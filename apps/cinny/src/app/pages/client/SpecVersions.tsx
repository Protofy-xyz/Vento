import React, { ReactNode } from 'react';
import { Box, Dialog, config, Text, Button } from 'folds';
import { SpecVersionsLoader } from '../../components/SpecVersionsLoader';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import { SplashScreen } from '../../components/splash-screen';
import { VentoSpinner } from '../../components/VentoSpinner';

export function SpecVersions({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  return (
    <SpecVersionsLoader
      baseUrl={baseUrl}
      fallback={() => (
        <SplashScreen>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
            <VentoSpinner size={48} />
            <Text style={{ color: 'var(--color, #F2F2F2)' }}>Connecting to server</Text>
          </Box>
        </SplashScreen>
      )}
      error={(err, retry, ignore) => (
        <SplashScreen>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
            <Dialog>
              <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
                <Text>
                  Failed to connect to homeserver. Either homeserver is down or your internet.
                </Text>
                <Button variant="Critical" onClick={retry}>
                  <Text as="span" size="B400">
                    Retry
                  </Text>
                </Button>
                <Button variant="Critical" onClick={ignore} fill="Soft">
                  <Text as="span" size="B400">
                    Continue
                  </Text>
                </Button>
              </Box>
            </Dialog>
          </Box>
        </SplashScreen>
      )}
    >
      {(versions) => <SpecVersionsProvider value={versions}>{children}</SpecVersionsProvider>}
    </SpecVersionsLoader>
  );
}
