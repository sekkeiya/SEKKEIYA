@echo off
echo Running gsutil
call gsutil cors set cors.json gs://shapeshare3d.firebasestorage.app 2>&1
echo Done gsutil
