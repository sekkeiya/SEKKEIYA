export function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(dateInput) {
    if (!dateInput) return "";
    
    let date;
    // Handle Firestore Timestamp
    if (typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
    } else if (dateInput && typeof dateInput.seconds === 'number') {
        // Handle serialized Timestamp
        date = new Date(dateInput.seconds * 1000);
    } else {
        date = new Date(dateInput);
    }

    // Safeguard against invalid dates
    if (isNaN(date.getTime())) return "";

    return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}
