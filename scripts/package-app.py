"""Package both application builds without external archiving dependencies."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
shutil.copyfile(root / 'dist-standalone/index.html', root / 'Aureo.html')
with zipfile.ZipFile(root / 'Aureo-bez-instalacji.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(root / 'Aureo.html', 'Aureo.html')
    archive.writestr('START.txt', '''AUREO — WERSJA BEZ INSTALACJI

1. Rozpakuj ZIP i otwórz Aureo.html w Chrome, Edge lub Firefox.
2. Dodaj podmiot, a w jego karcie dodaj aktywa.
3. W formularzu podmiotu lub aktywa wybierz Dodaj zdjęcie. Dowolne proporcje obrazu, bez przycinania.
4. Kliknij Profil przy rekordzie: otworzy się w nowej karcie. Edytuj finanse pozwala dodać zobowiązania, roczne przychody, wydatki i notatki.

Domyślna waluta to USD. Kwoty są skracane nazwami skali długiej: milion, miliard, bilion i kolejne, aż do centyliona. Kolory interfejsu: czerń, biel i szarości.
Zdjęcia JPG, PNG i WebP do 10 MB są zmniejszane do miniatury maks. 320 px i przechowywane lokalnie wraz z rekordem.
Kursy NBP wymagają internetu.

AKTUALIZACJA STAREJ WERSJI:
Najpierw otwórz starą aplikację i kliknij Eksportuj. Zachowaj kopię JSON.
Zastąp stary plik Aureo.html nowym w tym samym folderze i używaj tej samej przeglądarki.
Jeżeli wpisy nie są widoczne, przywróć kopię przyciskiem Importuj.
Starsze kopie bez zdjęć są obsługiwane.
Regularnie eksportuj dane — nie są synchronizowane między urządzeniami.
''')
with zipfile.ZipFile(root / 'aureo-do-publikacji.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / 'dist').rglob('*')):
        if file.is_file():
            archive.write(file, Path('dist') / file.relative_to(root / 'dist'))
    archive.writestr('JAK-URUCHOMIC.txt', 'Rozpakuj ZIP i opublikuj sam folder dist na hostingu statycznym. Plik index.html musi być w głównym katalogu witryny. Alternatywa bez hostingu: pobierz Aureo-bez-instalacji.zip z tego repozytorium.\n')
for name in ['Aureo-bez-instalacji.zip', 'aureo-do-publikacji.zip']:
    with zipfile.ZipFile(root / name) as archive:
        assert archive.testzip() is None
    print(f'{name}: OK ({(root / name).stat().st_size:,} bajtów)')
