with open('TOOLING.md', 'r') as f:
    content = f.read()
old = '''Contoh:
```bash
scripts/log-progress.sh bugs "Fix parser crash on empty file" "Parser TypeScript crash kalau file kosong (cuma license header). Fixed dengan nambahin early-return check di parseTs.ts."
```

Script ini otomatis:'''
new = '''Contoh:
```bash
scripts/log-progress.sh bugs "Fix parser crash on empty file" "Parser TypeScript crash kalau file kosong (cuma license header). Fixed dengan nambahin early-return check di parseTs.ts."
```

### Nutup plan lama yang udh dikerjain -- pakai close-plan

Kalau progres/PROGRES-decisions.md punya entry lama yang isinya "planned",
"not yet built", atau "next step", dan lo baru aja selesai ngerjain itu,
jangan cuma nambah entry status baru -- entry lama bakal kelihatan masih
pending selamanya kalau gak disentuh.

Pakai mode close-plan:

```bash
scripts/log-progress.sh close-plan <kategori> "<judul entry lama>" "<judul update baru>" "<isi update>"
```

Ini otomatis nyari entry lama berdasarkan potongan judulnya, nyisipin
pointer status di bawah header lama, dan nambahin entry baru berjudul
UPDATE: <judul> -- implemented di akhir file. Entry lama tidak dihapus,
histori tetep uteh.

Script ini otomatis:'''
assert old in content
content = content.replace(old, new, 1)
with open('TOOLING.md', 'w') as f:
    f.write(content)
print("done")
