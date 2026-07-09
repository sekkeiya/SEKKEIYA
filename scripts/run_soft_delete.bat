@echo off
node scripts\soft_delete_legacy_boards.mjs > soft_delete_output.txt 2>&1
node scripts\verify_soft_delete.mjs > verify_output.txt 2>&1
echo Done!
