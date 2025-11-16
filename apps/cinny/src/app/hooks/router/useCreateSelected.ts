import { useMatch } from 'react-router-dom';
import { getCreatePath } from '../../pages/pathUtils';

export const useCreateSelected = (): boolean => {
  const match = useMatch({
    path: getCreatePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};
