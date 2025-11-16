import { useMemo } from 'react';

export const useAccountManagementActions = () => {
  const actions = useMemo(
    () => ({
      profile: 'org.matrix.profile',
      sessionsList: 'org.matrix.sessions_list',
      sessionView: 'org.matrix.session_view',
      sessionEnd: 'org.matrix.session_end',
      accountDeactivate: 'org.matrix.account_deactivate',
      crossSigningReset: 'org.matrix.cross_signing_reset',
    }),
    []
  );

  return actions;
};
