import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import PresentsLandingPage from '../../pages/PresentsLandingPage';
import PresentsDashboardPage from '../../pages/PresentsDashboardPage';
import { PresentsEditorPage } from '../../pages/PresentsEditorPage';
import { PresentsViewerPage } from '../../pages/PresentsViewerPage';
import { PresentsTemplatesPage } from '../../pages/PresentsTemplatesPage';
import ProtectedRoute from '../routes/ProtectedRoute';
import AppLayout from '../../shared/layout/AppLayout';

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <PresentsLandingPage />,
    },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          path: "projects/:projectId/workspaces/presents",
          element: <PresentsDashboardPage />,
        },
        {
          path: "projects/:projectId/workspaces/presents/:section",
          element: <PresentsDashboardPage />,
        },
        {
          path: "projects/:projectId/workspaces/presents/editor/:itemId",
          element: <PresentsEditorPage />,
        },
        {
          path: "projects/:projectId/workspaces/presents/viewer/:itemId",
          element: <PresentsViewerPage />,
        },
        {
          path: "projects/:projectId/workspaces/presents/templates",
          element: <PresentsTemplatesPage />,
        }
      ]
    }
  ],
  {
    basename: "/app/presents",
  }
);
