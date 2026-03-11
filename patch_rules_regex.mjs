import fs from 'fs';

let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  /function isPublic\(data\) \{\s*return \(data\.visibility == "public"\) \|\|\s*\(data\.isPublic == true && !\(data\.isPrivate == true\)\);\s*\}/s,
  `function isPublic(data) {
    return (data.get("visibility", "") == "public") ||
           (data.get("isPublic", false) == true && !(data.get("isPrivate", false) == true));
  }`
);

content = content.replace(
  /allow read:\s*if isPublic\(resource\.data\)\s*\|\|\s*\(isSignedIn\(\) && resource\.data\.ownerId == request\.auth\.uid\)\s*\|\|\s*\(isSignedIn\(\) && \(resource\.data\.memberIds is list\) && request\.auth\.uid in resource\.data\.memberIds\);/s,
  `allow read: if isPublic(resource.data) 
                  || (isSignedIn() && resource.data.get("ownerId", "") == request.auth.uid)
                  || (isSignedIn() && (resource.data.get("memberIds", []) is list) && request.auth.uid in resource.data.get("memberIds", []));`
);

fs.writeFileSync('firestore.rules', content);
console.log("Regex replacement finished.");
