import fs from 'fs';

let content = fs.readFileSync('firestore.rules', 'utf8');

const t1 = 'return (data.visibility == "public") ||\\n           (data.isPublic == true && !(data.isPrivate == true));';
const t1_win = 'return (data.visibility == "public") ||\\r\\n           (data.isPublic == true && !(data.isPrivate == true));';
const r1 = 'return (data.get("visibility", "") == "public") ||\\n           (data.get("isPublic", false) == true && !(data.get("isPrivate", false) == true));';
const r1_win = 'return (data.get("visibility", "") == "public") ||\\r\\n           (data.get("isPublic", false) == true && !(data.get("isPrivate", false) == true));';

content = content.replace(t1, r1);
content = content.replace(t1_win, r1_win);


const t2 = 'allow read: if isPublic(resource.data) \\n                  || (isSignedIn() && resource.data.ownerId == request.auth.uid)\\n                  || (isSignedIn() && (resource.data.memberIds is list) && request.auth.uid in resource.data.memberIds);';
const t2_win = 'allow read: if isPublic(resource.data) \\r\\n                  || (isSignedIn() && resource.data.ownerId == request.auth.uid)\\r\\n                  || (isSignedIn() && (resource.data.memberIds is list) && request.auth.uid in resource.data.memberIds);';
const r2 = 'allow read: if isPublic(resource.data) \\n                  || (isSignedIn() && resource.data.get("ownerId", "") == request.auth.uid)\\n                  || (isSignedIn() && request.auth.uid in resource.data.get("memberIds", []));';
const r2_win = 'allow read: if isPublic(resource.data) \\r\\n                  || (isSignedIn() && resource.data.get("ownerId", "") == request.auth.uid)\\r\\n                  || (isSignedIn() && request.auth.uid in resource.data.get("memberIds", []));';

content = content.replace(t2, r2);
content = content.replace(t2_win, r2_win);

fs.writeFileSync('firestore.rules', content);
console.log("Replaced rules successfully.");
