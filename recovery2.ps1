Set-Location "C:\Users\sekkeiya\02-WebApp\028-R3DM-ver2\r3dm-share"
git status | Out-File "C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya\ps_log.txt"
git checkout HEAD -- src/features/Dashboard/Main/ModelsList/ModelCardPreview/ModelDetailContent.jsx 2>&1 | Out-File "C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya\ps_log.txt" -Append
git status | Out-File "C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya\ps_log.txt" -Append
