import { useSpecVersions } from './useSpecVersions';

export const useReportRoomSupported = (): boolean => {
  const { versions, unstable_features: unstableFeatures } = useSpecVersions();

  // report room is introduced in spec version 1.13
  const supported = unstableFeatures?.['org.matrix.msc4151'] || versions.includes('v1.13');

  return supported;
};
