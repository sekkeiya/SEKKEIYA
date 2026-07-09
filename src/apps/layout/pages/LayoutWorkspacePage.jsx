// src/pages/LayoutWorkspacePage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, CircularProgress } from "@mui/material";

import LayoutShell from "../features/layout/editor/LayoutShell";
import { useAuth } from "@layout/features/auth/AuthContext";
import { getWorkspaceById } from "@layout/shared/api/workspaces/workspaces";

export default function LayoutWorkspacePage() {
    const params = useParams();
    const { user } = useAuth();
    const uid = user?.uid ?? null;

    const projectId = params.projectId;
    const workspaceId = params.workspaceId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [workspaceName, setWorkspaceName] = useState("Untitled Workspace");
    const [selectedBaseId, setSelectedBaseId] = useState(null);
    const [selectedPlanId, setSelectedPlanId] = useState(null);

    useEffect(() => {
        let alive = true;

        async function init() {
            if (!uid) {
                if (alive) {
                    setError("Not authenticated.");
                    setLoading(false);
                }
                return;
            }

            if (!projectId || !workspaceId) {
                if (alive) {
                    setError("projectId or workspaceId is missing.");
                    setLoading(false);
                }
                return;
            }

            setLoading(true);
            setError("");

            try {
                const workspace = await getWorkspaceById(projectId, workspaceId);
                if (!workspace) throw new Error("Workspace not found.");

                if (alive) {
                    setWorkspaceName(workspace.name || "Untitled Workspace");
                    setSelectedBaseId(workspace.currentBaseId || null);
                    setSelectedPlanId(workspace.currentPlanId || null);
                    setLoading(false);
                }
            } catch (err) {
                if (alive) {
                    setError(err.message || String(err));
                    setLoading(false);
                }
            }
        }

        init();

        return () => {
            alive = false;
        };
    }, [uid, projectId, workspaceId]);

    // Error
    if (error) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography variant="h6" color="error">
                    Error
                </Typography>
                <Typography>{error}</Typography>
            </Box>
        );
    }

    // Loading
    if (loading) {
        return (
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <LayoutShell
            projectId={projectId}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            initialBaseId={selectedBaseId}
            initialPlanId={selectedPlanId}
        />
    );
}
