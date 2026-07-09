import React from 'react';
import { ProjectManagementPage as GlobalProjectManagementPage } from '@sekkeiya/global-panel';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function ProjectManagementPage() {
    const { user } = useAuth();
    return <GlobalProjectManagementPage user={user} />;
}
