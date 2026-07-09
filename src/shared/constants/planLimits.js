export const planLimits = {
    free: {
        myPrivateBoardLimit: 3,
        teamMemberLimit: 5,
        privateStorageLimitBytes: 5 * 1024 * 1024 * 1024,
    },
    standard: {
        myPrivateBoardLimit: 10,
        teamMemberLimit: 20,
        privateStorageLimitBytes: 100 * 1024 * 1024 * 1024,
    },
    premium: {
        myPrivateBoardLimit: Infinity,
        teamMemberLimit: Infinity,
        privateStorageLimitBytes: 300 * 1024 * 1024 * 1024,
    },
};
