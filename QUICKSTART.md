# ARCLUX Quickstart

## Alur kerja
git checkout main
git pull origin main
git checkout -b tipe/nama-branch
git add file
git commit -m "pesan"
git push origin tipe/nama-branch
gh pr create --repo GSF-001/ARCLUX --title "judul" --body "penjelasan"
gh pr merge NOMOR --repo GSF-001/ARCLUX --merge --delete-branch
git checkout main
git pull origin main
