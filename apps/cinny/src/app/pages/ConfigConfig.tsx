import { Box, Button, Dialog, Text, color, config } from 'folds';
import React from 'react';
import { SplashScreen } from '../components/splash-screen';
import { VentoSpinner } from '../components/VentoSpinner';

export function ConfigConfigLoading() {
  return (
    <SplashScreen>
      <Box grow="Yes" direction="Column" gap="400" alignItems="Center" justifyContent="Center">
        <VentoSpinner size={48} />
        <Text style={{ color: 'var(--color, #F2F2F2)' }}>Heating up</Text>
      </Box>
    </SplashScreen>
  );
}

type ConfigConfigErrorProps = {
  error: unknown;
  retry: () => void;
  ignore: () => void;
};
export function ConfigConfigError({ error, retry, ignore }: ConfigConfigErrorProps) {
  return (
    <SplashScreen>
      <Box grow="Yes" direction="Column" gap="400" alignItems="Center" justifyContent="Center">
        <Dialog>
          <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
            <Box direction="Column" gap="100">
              <Text>Failed to load client configuration file.</Text>
              {typeof error === 'object' &&
                error &&
                'message' in error &&
                typeof error.message === 'string' && (
                  <Text size="T300" style={{ color: color.Critical.Main }}>
                    {error.message}
                  </Text>
                )}
            </Box>
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
  );
}
