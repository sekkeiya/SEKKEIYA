export const planLimits = {
    free: {
        myPrivateBoardLimit: 3,
        teamBoardJoinLimit: 1,
        teamPrivateOwnedLimit: 0,
        privateStorageLimitBytes: 5 * 1024 * 1024 * 1024,
    },
    standard: {
        myPrivateBoardLimit: 10,
        teamBoardJoinLimit: 10,
        teamPrivateOwnedLimit: 5,
        privateStorageLimitBytes: 100 * 1024 * 1024 * 1024,
    },
    premium: {
        myPrivateBoardLimit: Infinity,
        teamBoardJoinLimit: Infinity,
        teamPrivateOwnedLimit: 30,
        privateStorageLimitBytes: 300 * 1024 * 1024 * 1024,
    },
};
