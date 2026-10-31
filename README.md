# strange-archivx
Structured archive of visual and textual assets related to the Strange Chronology project.

## Aureo — rejestr majątku

Polskojęzyczna aplikacja do prowadzenia rejestru osób, firm i organizacji oraz ich aktywów. React, TypeScript i Vite; bez konta i bez serwera przechowującego dane.

### Uruchomienie

Wymagany Node.js 22+ i npm (sprawdzono na Node.js 24).

```sh
cd /workspace/strange-archivx
npm ci
npm run dev
```

Serwer deweloperski korzysta domyślnie z portu 5173. Produkcyjny build: `npm run build`; lokalne sprawdzenie buildu: `npm run preview`. Do hostowania wystarczy serwer plików statycznych z katalogiem `dist/`, najlepiej przez HTTPS.

### Funkcje

- Dodawanie, edycja i usuwanie podmiotów oraz ich aktywów; wyszukiwanie, filtrowanie i sortowanie rejestru.
- Kategorie: inwestycje, nieruchomości, udziały w firmach, gotówka i depozyty oraz pozostałe aktywa.
- Kwoty do 1000 cyfr przed przecinkiem i 100 po przecinku. Należy wpisywać pełne liczby, z kropką lub przecinkiem dziesiętnym; spacje grupujące cyfry są dozwolone. Zapis wykładniczy nie jest przyjmowany.
- Kwoty źródłowe są tekstem; obliczenia wykorzystują ułamki oparte na `BigInt`. Zaokrąglanie połówek w górę do dwóch miejsc następuje dopiero przy wyświetlaniu, po sumowaniu. Interfejs skraca kwoty nazwami ze skali długiej (np. 3,42 miliarda USD, 1,00 bilion USD), aż do centyliona (10^600). Pełne wartości pozostają w edycji, podpowiedziach i eksporcie. Domyślną walutą widoku i nowych aktywów jest USD; istniejące aktywa zachowują swoje waluty źródłowe.
- 13 walut; kursy średnie tabeli A NBP pobierane przy starcie, na żądanie i co godzinę. Przeliczenie: kwota × kurs waluty źródłowej w PLN ÷ kurs waluty docelowej w PLN. Zmiana waluty widoku nie zmienia danych źródłowych.
- Ostatnia poprawna tabela jest buforowana. Przy awarii połączenia aplikacja oznacza ją jako zapisaną i pokazuje datę. Bez kursów niepełne sumy są oznaczane jako „—”; kwoty w tej samej walucie pozostają dostępne. Nie ma zastępczych, przykładowych kursów.
- Eksport i import kopii JSON z walidacją i potwierdzeniem zastąpienia rejestru; raport CSV do arkuszy. CSV zawiera oryginalne kwoty jako tekst, ale arkusze mogą automatycznie tracić precyzję — do kopii i przenoszenia danych używaj JSON.

### Dane i połączenia

Rejestr jest zapisywany w `localStorage` tego profilu przeglądarki, pod kluczem `aureo.registry.v1`. Nie jest synchronizowany między urządzeniami, szyfrowany ani chroniony hasłem. Eksportuj regularnie kopię JSON; wyczyszczenie danych witryny usuwa rejestr. Niepoprawny zapis nie jest automatycznie nadpisywany; interfejs pozwala pobrać oryginał do odzyskiwania.

Nowa przeglądarka pokazuje wyraźnie oznaczone dane przykładowe. Opcja „Usuń dane przykładowe” czyści cały rejestr po potwierdzeniu, również własne wpisy dodane do przykładów.

Jedynym połączeniem zewnętrznym aplikacji jest publiczne API `https://api.nbp.pl/api/exchangerates/tables/A/?format=json` (bez klucza API). W środowisku z ograniczoną siecią należy dopuścić `api.nbp.pl`. Kursy pobiera przeglądarka użytkownika. Czcionki są serwowane lokalnie. NBP publikuje tabelę A w dni robocze; są to kursy średnie, a nie oferty transakcyjne.

### Weryfikacja

```sh
npm run build
npm test
npm run test:e2e
```

Testy obliczeń obejmują 1000-cyfrowe kwoty, precyzję sumowania i przewalutowania oraz walidację kopii danych. Testy przeglądarkowe obejmują CRUD, trwałość zapisu, import/eksport, awarię sieci, bufor kursów i widok mobilny. W testach przeglądarkowych odpowiedzi NBP są kontrolowanymi danymi testowymi, nie potwierdzają bieżącego połączenia z NBP.

Playwright używa systemowego Chromium (`/usr/bin/chromium`); inną lokalizację podaj jako `CHROMIUM_PATH`. W razie braku systemowego Chromium zainstaluj przeglądarkę i ustaw tę zmienną. W restrykcyjnym sandboxie testy i Vite wymagają możliwości otwierania lokalnych gniazd/portów.

Oryginalny zasób `agnesstrange2025.png` pozostawiono bez zmian.

### Wersja bez hostingu

Pobierz `Aureo-bez-instalacji.zip`, rozpakuj i otwórz `Aureo.html` w przeglądarce. Kod, style i fonty są w jednym pliku. Kursy NBP wymagają internetu. Dane pozostają w lokalnym zapisie przeglądarki; eksportuj regularnie kopię i używaj pliku z tego samego miejsca na dysku. Budowanie tej wersji: `npm run build:standalone` (wynik `dist-standalone/index.html`). Weryfikacja uruchomienia przez `file://` w zarządzanym Chromium środowiska była zablokowana przez politykę administratora; sprawdzono renderowanie, zapis i ponowne odczytanie pojedynczego HTML przez lokalny adres HTTP.

### Miniatury i aktualizacje

Formularze podmiotów i aktywów pozwalają dodać, zmienić lub usunąć zdjęcie JPG, PNG lub WebP (plik do 10 MB). Obraz jest zmniejszany lokalnie do maks. 320 px i zapisywany wraz z rekordem; nie jest wysyłany na serwer. Kopie JSON obejmują zdjęcia. Starsze kopie bez zdjęć są nadal obsługiwane. Liczba miniatur zależy od limitu pamięci przeglądarki — nieudany zapis jest zgłaszany i nie zastępuje poprzednich danych.

Przed zmianą pliku HTML wyeksportuj kopię danych. Zastąp plik w tym samym miejscu na dysku, zachowując nazwę `Aureo.html` i przeglądarkę. Jeśli przeglądarka nie udostępni starego zapisu, przywróć kopię JSON przez Importuj.

Powtarzalne przygotowanie obu paczek: `npm run package:download` (wymaga Python 3). Interfejs ma neutralną, czarno-białą paletę; zdjęcia zachowują oryginalne kolory. Pierwsze uruchomienie tej wersji ustawia USD, pomijając starą preferencję waluty v1; dalsze wybory są zapamiętywane pod kluczem `aureo.currency.v2`.

### Profile finansowe w nowej karcie

Kliknij „Profil” przy rekordzie lub w jego karcie szczegółów. Profil otwiera się w nowej karcie pod adresem z fragmentem `#profil/ID` (również dla pojedynczego pliku HTML). Przed otwarciem zapisujemy rejestr, aby identyfikatory przykładów i nowe dane były dostępne w drugiej karcie. Zmiany rejestru są odświeżane między kartami przez zdarzenia storage i po powrocie do karty.

Profil pokazuje aktywa brutto, zobowiązania, majątek netto, roczne przychody/dochody, koszty/wydatki oraz nadwyżkę lub deficyt. „Edytuj finanse” pozwala zapisać te kwoty w wybranej walucie i dodać notatki. Bez zadeklarowanych danych finansowych pokazujemy „—”, a nie pozorne zera. Profil obejmuje również strukturę majątku, ekspozycję walutową i aktywa od największego. Można wyeksportować sam profil jako zgodną kopię JSON.

Zdjęcia mogą mieć dowolne proporcje. Są skalowane proporcjonalnie, a we wszystkich miniaturach i na profilu wyświetlamy cały obraz przez object-fit: contain, bez przycinania do kwadratu. Format pliku nadal musi być JPG, PNG lub WebP.

Skala nazw odpowiada dostarczonej tabeli: tysiąc (10^3), milion (10^6), miliard (10^9), bilion (10^12), biliard (10^15), trylion (10^18), tryliard (10^21), kwadrylion (10^24), kwintylion (10^30), sekstylion (10^36), septylion (10^42), oktylion (10^48), nonylion (10^54), decylion (10^60), centylion (10^600). Pomiędzy wymienionymi progami stosujemy wielokrotność największej dostępnej nazwy. Kwoty wyświetlane są zaokrąglane do dwóch miejsc, a zapis źródłowy pozostaje dokładny.
