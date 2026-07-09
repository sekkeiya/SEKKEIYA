@echo off
echo Deleting legacy models collections for all users...

call firebase firestore:delete --force -r --project shapeshare3d "users/4hvZOWCsjbY5R5T3zHWNWS3aOSj2/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/Fp9jDsOzgUg7btoGM2YtyK5UD503/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/K67Fm1A2fZdAWWAXda83i974XOE3/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/SLydmMRV3HRyW5BNDCZp7xSiFgn2/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/dZLeURsXfIctrwkOBWUf7kiTJYV2/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/lsCMknN1XtSP1IK5hNL13F1AKoi1/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/m9V1Odey4qc5JorXBdQmCU6klIx2/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/xoMGBlcutqRj7ZzL4T7Co0nAScF3/models"
call firebase firestore:delete --force -r --project shapeshare3d "users/ydMdVQlOKYZMOrnIU4vqmlCg1ls2/models"

echo Done!
